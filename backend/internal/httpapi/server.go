package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"moodlepilot/backend/internal/ai"
	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/backup"
	"moodlepilot/backend/internal/config"
	"moodlepilot/backend/internal/coursegen"
	"moodlepilot/backend/internal/mail"
	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

type Server struct {
	cfg         config.Config
	store       *store.Store
	mailer      mail.Mailer
	asynqClient *asynq.Client
	runtime     provisioning.Runtime
	backupStore *backup.Storage
	aiClient    *ai.Client
	courseGen   *coursegen.Generator
}

type listSessionsResponse struct {
	Sessions         []store.Session `json:"sessions"`
	CurrentSessionID *uuid.UUID      `json:"current_session_id"`
}

type contextKey string

const (
	userContextKey    contextKey = "user"
	sessionContextKey contextKey = "session"
)

func New(cfg config.Config, st *store.Store, mailer mail.Mailer, client *asynq.Client, runtime provisioning.Runtime, backupStore *backup.Storage, aiClient *ai.Client, courseGen *coursegen.Generator) *Server {
	return &Server{
		cfg:         cfg,
		store:       st,
		mailer:      mailer,
		asynqClient: client,
		runtime:     runtime,
		backupStore: backupStore,
		aiClient:    aiClient,
		courseGen:   courseGen,
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.Timeout(30 * time.Second))
	r.Use(limitRequestBody(maxRequestBodySize))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{s.cfg.FrontendOrigin},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Rate limiters: auth = 5 req/s burst 10 per IP, internal = 2 req/s burst 5
	authRateLimit := rateLimitByIP(5, 10)
	internalRateLimit := rateLimitByIP(2, 5)

	r.Route("/v1", func(r chi.Router) {
		r.Get("/healthz", s.handleHealth)
		r.Get("/plans", s.handleListPlans)
		r.Get("/sites/subdomain-availability", s.handleSubdomainAvailability)

		r.Group(func(r chi.Router) {
			r.Use(internalRateLimit)
			r.Post("/internal/moodle/report/bootstrap", s.handleBootstrapSiteReportPlugin)
			r.Post("/internal/moodle/report/connect", s.handleConnectSiteReportPlugin)
			r.Post("/internal/moodle/report/ingest", s.handleIngestSiteReportSnapshot)
		})

		r.Route("/auth", func(r chi.Router) {
			r.Use(authRateLimit)
			r.Post("/register", s.handleRegister)
			r.Post("/verify-email", s.handleVerifyEmail)
			r.Post("/resend-verification", s.handleResendVerification)
			r.Post("/login", s.handleLogin)
			r.Post("/logout", s.handleLogout)
			r.Post("/forgot-password", s.handleForgotPassword)
			r.Post("/reset-password", s.handleResetPassword)
		})

		r.Post("/courses/generate-outline", s.handleGenerateOutline)
		r.Post("/courses/export-mbz", s.handleExportMBZ)

		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Get("/me", s.handleGetMe)
			r.Patch("/me", s.handleUpdateMe)
			r.Patch("/me/password", s.handleUpdatePassword)
			r.Get("/me/sessions", s.handleListSessions)
			r.Delete("/me/sessions/{sessionID}", s.handleDeleteSession)
			r.Get("/me/notification-preferences", s.handleGetNotificationPreferences)
			r.Put("/me/notification-preferences", s.handleUpdateNotificationPreferences)

			r.Get("/sites", s.handleListSites)
			r.Post("/sites", s.handleCreateSite)
			r.Get("/sites/{siteID}", s.handleGetSiteByID)
			r.Patch("/sites/{siteID}", s.handleUpdateSite)
			r.Delete("/sites/{siteID}", s.handleDeleteSite)
			r.Get("/sites/{siteID}/settings", s.handleGetSiteSettings)
			r.Get("/sites/{siteID}/usage", s.handleGetSiteUsage)
			r.Get("/sites/{siteID}/provisioning", s.handleGetProvisioningBySiteID)
			r.Get("/sites/{siteID}/runtime", s.handleGetSiteRuntime)
			r.Get("/sites/{siteID}/report-connection", s.handleGetSiteReportConnection)
			r.Post("/sites/{siteID}/report-connection/connect-token", s.handleIssueSiteReportConnectToken)
			r.Get("/sites/{siteID}/reports/summary", s.handleGetSiteReportSummary)
			r.Get("/sites/{siteID}/reports/full", s.handleGetSiteFullReport)
			r.Get("/sites/{siteID}/reports/detail", s.handleGetSiteReportDetail)
			r.Get("/sites/{siteID}/reports/latest", s.handleGetLatestSiteReportSnapshot)
			r.Get("/sites/{siteID}/backups", s.handleGetSiteBackups)
			r.Post("/sites/{siteID}/backups", s.handleCreateSiteBackup)
			r.Put("/sites/{siteID}/backups/settings", s.handleUpdateSiteBackupSettings)
			r.Get("/sites/{siteID}/backups/{backupID}/download", s.handleDownloadSiteBackup)
			r.Post("/sites/{siteID}/runtime/start", s.handleStartSiteRuntime)
			r.Post("/sites/{siteID}/runtime/restart", s.handleRestartSiteRuntime)
			r.Post("/sites/{siteID}/runtime/stop", s.handleStopSiteRuntime)
			r.Post("/sites/{siteID}/custom-domain", s.handleUpsertSiteCustomDomain)
			r.Delete("/sites/{siteID}/custom-domain", s.handleDeleteSiteCustomDomain)
			r.Get("/sites/by-subdomain/{subdomain}", s.handleGetSiteBySubdomain)

			r.Get("/notifications", s.handleListNotifications)
			r.Post("/notifications/read-all", s.handleMarkAllNotificationsRead)
			r.Post("/notifications/{notificationID}/read", s.handleMarkNotificationRead)
			r.Delete("/notifications/{notificationID}", s.handleDeleteNotification)
		})
	})

	return r
}

// --- Public handlers ---

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := s.store.ListPlans(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"plans": plans})
}

func (s *Server) handleSubdomainAvailability(w http.ResponseWriter, r *http.Request) {
	value := normalizeSubdomain(r.URL.Query().Get("value"))
	if value == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"available": false, "reason": "Subdomain wajib diisi"})
		return
	}
	if !isValidSubdomain(value) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"available": false, "reason": "Gunakan huruf kecil, angka, dan tanda hubung"})
		return
	}
	if isReservedSubdomain(value) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"available": false, "reason": "Subdomain termasuk nama yang dicadangkan"})
		return
	}

	available, err := s.store.IsSubdomainAvailable(r.Context(), value)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"available": available})
}

// --- Auth middleware ---

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(s.cfg.SessionCookieName)
		if err != nil || strings.TrimSpace(cookie.Value) == "" {
			writeError(w, http.StatusUnauthorized, "Login diperlukan")
			return
		}

		sessionID, secret, err := parseSessionCookie(cookie.Value)
		if err != nil {
			s.clearSessionCookie(w)
			writeError(w, http.StatusUnauthorized, "Session tidak valid")
			return
		}

		lookup, err := s.store.GetSessionLookup(r.Context(), sessionID)
		if err != nil {
			s.clearSessionCookie(w)
			writeError(w, http.StatusUnauthorized, "Session tidak ditemukan")
			return
		}
		if time.Now().UTC().After(lookup.ExpiresAt) || !auth.CompareTokenHash(lookup.SecretHash, secret) {
			_ = s.store.DeleteSession(r.Context(), lookup.ID)
			s.clearSessionCookie(w)
			writeError(w, http.StatusUnauthorized, "Session sudah berakhir")
			return
		}

		if err := s.store.TouchSession(r.Context(), lookup.ID); err != nil {
			log.Printf("touch session error: %v", err)
		}

		ctx := context.WithValue(r.Context(), userContextKey, lookup.User)
		ctx = context.WithValue(ctx, sessionContextKey, lookup.Session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// --- Cookie helpers ---

func (s *Server) setSessionCookie(w http.ResponseWriter, sessionID uuid.UUID, secret string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.SessionCookieName,
		Value:    fmt.Sprintf("%s.%s", sessionID.String(), secret),
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

// --- Context helpers ---

func currentUser(ctx context.Context) *store.User {
	user, ok := ctx.Value(userContextKey).(store.User)
	if !ok {
		return nil
	}
	return &user
}

func currentSession(ctx context.Context) *store.Session {
	session, ok := ctx.Value(sessionContextKey).(store.Session)
	if !ok {
		return nil
	}
	return &session
}

func currentSessionID(ctx context.Context) *uuid.UUID {
	session := currentSession(ctx)
	if session == nil {
		return nil
	}

	sessionID := session.ID
	return &sessionID
}

// --- Utility helpers ---

func decodeJSON(r *http.Request, dst interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return fmt.Errorf("request body tidak valid: %w", err)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write json error: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func parseSessionCookie(raw string) (uuid.UUID, string, error) {
	parts := strings.Split(raw, ".")
	if len(parts) != 2 {
		return uuid.Nil, "", errors.New("session cookie invalid")
	}
	sessionID, err := uuid.Parse(parts[0])
	if err != nil {
		return uuid.Nil, "", err
	}
	return sessionID, parts[1], nil
}

func siteURLForSubdomain(cfg config.Config, subdomain string) string {
	siteURL, _ := provisioning.BuildSiteURLs(cfg, subdomain)
	return siteURL
}

func adminURLForSubdomain(cfg config.Config, subdomain string) string {
	_, adminURL := provisioning.BuildSiteURLs(cfg, subdomain)
	return adminURL
}

func normalizeSubdomain(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case r == '-':
			builder.WriteRune(r)
		}
	}
	return strings.Trim(builder.String(), "-")
}

func isValidSubdomain(value string) bool {
	if len(value) < 3 || len(value) > 32 {
		return false
	}
	if strings.HasPrefix(value, "-") || strings.HasSuffix(value, "-") || strings.Contains(value, "--") {
		return false
	}
	return value == normalizeSubdomain(value)
}

func isReservedSubdomain(value string) bool {
	reserved := map[string]struct{}{
		"admin":  {},
		"api":    {},
		"demo":   {},
		"moodle": {},
		"mail":   {},
		"test":   {},
		"www":    {},
	}
	_, exists := reserved[value]
	return exists
}

func looksLikeEmail(value string) bool {
	value = strings.TrimSpace(value)
	return strings.Contains(value, "@") && strings.Contains(value, ".")
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
