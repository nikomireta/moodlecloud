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
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{s.cfg.FrontendOrigin},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/v1", func(r chi.Router) {
		r.Get("/healthz", s.handleHealth)
		r.Get("/plans", s.handleListPlans)
		r.Get("/sites/subdomain-availability", s.handleSubdomainAvailability)

		r.Route("/auth", func(r chi.Router) {
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

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name            string `json:"name"`
		Email           string `json:"email"`
		Company         string `json:"company"`
		Organization    string `json:"organization"`
		Password        string `json:"password"`
		ConfirmPassword string `json:"confirm_password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.Name) == "" || auth.SanitizeEmail(req.Email) == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Nama, email, dan kata sandi wajib diisi")
		return
	}
	if req.Password != req.ConfirmPassword {
		writeError(w, http.StatusBadRequest, "Konfirmasi kata sandi tidak cocok")
		return
	}
	if !looksLikeEmail(req.Email) {
		writeError(w, http.StatusBadRequest, "Format email tidak valid")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "Kata sandi minimal 8 karakter")
		return
	}

	if _, err := s.store.GetUserByEmail(r.Context(), req.Email); err == nil {
		writeError(w, http.StatusConflict, "Email sudah terdaftar")
		return
	} else if !errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	user, err := s.store.CreateUser(r.Context(), store.CreateUserParams{
		Name:         strings.TrimSpace(req.Name),
		Email:        req.Email,
		Company:      strings.TrimSpace(req.Company),
		Organization: strings.TrimSpace(req.Organization),
		PasswordHash: passwordHash,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	code := auth.NewVerificationCode()
	if err := s.store.CreateEmailVerification(r.Context(), user.ID, code, time.Now().UTC().Add(s.cfg.VerifyEmailTTL)); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.mailer.SendVerificationCode(user, code); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_, _ = s.store.CreateNotification(r.Context(), store.CreateNotificationParams{
		UserID:    user.ID,
		Type:      "info",
		Category:  "update",
		Title:     "Akun berhasil dibuat",
		Message:   "Silakan verifikasi email Anda untuk mulai menggunakan Moodlepilot.",
		ActionURL: "/verifikasi-email",
	})

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"user":    user,
		"message": "Akun berhasil dibuat. Kode verifikasi sudah dikirim ke email Anda.",
	})
}

func (s *Server) handleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, err := s.store.ConsumeEmailVerification(r.Context(), req.Email, strings.TrimSpace(req.Code))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user":    user,
		"message": "Email berhasil diverifikasi",
	})
}

func (s *Server) handleResendVerification(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, err := s.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusOK, map[string]string{"message": "Jika email terdaftar, kode baru akan dikirim."})
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	code := auth.NewVerificationCode()
	if err := s.store.CreateEmailVerification(r.Context(), user.ID, code, time.Now().UTC().Add(s.cfg.VerifyEmailTTL)); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.mailer.SendVerificationCode(user.User, code); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Kode verifikasi baru telah dikirim."})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email      string `json:"email"`
		Password   string `json:"password"`
		RememberMe bool   `json:"remember_me"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, err := s.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Email atau kata sandi salah")
		return
	}
	if err := auth.ComparePassword(user.PasswordHash, req.Password); err != nil {
		writeError(w, http.StatusUnauthorized, "Email atau kata sandi salah")
		return
	}
	if user.EmailVerifiedAt == nil {
		writeError(w, http.StatusForbidden, "Email belum diverifikasi")
		return
	}

	sessionSecret, err := auth.NewSessionSecret()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sessionTTL := s.cfg.SessionTTL
	if req.RememberMe {
		sessionTTL = s.cfg.RememberMeTTL
	}
	session, err := s.store.CreateSession(r.Context(), store.CreateSessionParams{
		UserID:     user.ID,
		SecretHash: auth.HashToken(sessionSecret),
		UserAgent:  r.UserAgent(),
		IPAddress:  clientIP(r),
		RememberMe: req.RememberMe,
		ExpiresAt:  time.Now().UTC().Add(sessionTTL),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.setSessionCookie(w, session.ID, sessionSecret, session.ExpiresAt)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user":    user.User,
		"message": "Login berhasil",
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	session := currentSession(r.Context())
	if session != nil {
		_ = s.store.DeleteSession(r.Context(), session.ID)
	}
	s.clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]string{"message": "Logout berhasil"})
}

func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, err := s.store.GetUserByEmail(r.Context(), req.Email)
	if err == nil {
		token, tokenErr := auth.NewOpaqueToken()
		if tokenErr != nil {
			writeError(w, http.StatusInternalServerError, tokenErr.Error())
			return
		}
		if err := s.store.CreatePasswordReset(r.Context(), user.ID, token, time.Now().UTC().Add(s.cfg.PasswordResetTTL)); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if err := s.mailer.SendPasswordReset(user.User, token); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Jika email terdaftar, instruksi reset akan dikirim."})
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "Kata sandi baru minimal 8 karakter")
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.store.ConsumePasswordReset(r.Context(), strings.TrimSpace(req.Token), hash); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Kata sandi berhasil direset"})
}

func (s *Server) handleGetMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"user": currentUser(r.Context())})
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	var req struct {
		Name         string `json:"name"`
		Company      string `json:"company"`
		Organization string `json:"organization"`
		Phone        string `json:"phone"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	user.Name = strings.TrimSpace(req.Name)
	user.Company = strings.TrimSpace(req.Company)
	user.Organization = strings.TrimSpace(req.Organization)
	user.Phone = strings.TrimSpace(req.Phone)
	if user.Name == "" {
		writeError(w, http.StatusBadRequest, "Nama wajib diisi")
		return
	}
	updated, err := s.store.UpdateUser(r.Context(), *user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"user": updated, "message": "Profil berhasil diperbarui"})
}

func (s *Server) handleUpdatePassword(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	authUser, err := s.store.GetUserByEmail(r.Context(), user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := auth.ComparePassword(authUser.PasswordHash, req.CurrentPassword); err != nil {
		writeError(w, http.StatusBadRequest, "Kata sandi saat ini salah")
		return
	}
	if len(req.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "Kata sandi baru minimal 8 karakter")
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.store.UpdateUserPassword(r.Context(), user.ID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Kata sandi berhasil diperbarui"})
}

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	sessions, err := s.store.ListUserSessions(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, listSessionsResponse{
		Sessions:         sessions,
		CurrentSessionID: currentSessionID(r.Context()),
	})
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Session ID tidak valid")
		return
	}
	if err := s.store.DeleteSessionForUser(r.Context(), user.ID, sessionID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	current := currentSession(r.Context())
	if current != nil && current.ID == sessionID {
		s.clearSessionCookie(w)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Session berhasil dihapus"})
}

func (s *Server) handleGetNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	prefs, err := s.store.GetNotificationPreferences(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"preferences": prefs})
}

func (s *Server) handleUpdateNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	var req struct {
		Email map[string]bool `json:"email"`
		Push  map[string]bool `json:"push"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	prefs, err := s.store.UpdateNotificationPreferences(r.Context(), user.ID, store.NotificationPreferences{
		Email: req.Email,
		Push:  req.Push,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"preferences": prefs, "message": "Preferensi notifikasi diperbarui"})
}

func (s *Server) handleListSites(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	sites, err := s.store.ListSitesByOwner(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"sites": sites})
}

func (s *Server) handleCreateSite(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	var req struct {
		Name       string `json:"name"`
		Subdomain  string `json:"subdomain"`
		PlanCode   string `json:"plan_code"`
		Region     string `json:"region"`
		AdminName  string `json:"admin_name"`
		AdminEmail string `json:"admin_email"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Subdomain = normalizeSubdomain(req.Subdomain)
	req.PlanCode = strings.TrimSpace(req.PlanCode)
	req.Region = strings.TrimSpace(req.Region)

	if strings.TrimSpace(req.Name) == "" || req.Subdomain == "" || req.PlanCode == "" || req.Region == "" || strings.TrimSpace(req.AdminName) == "" || strings.TrimSpace(req.AdminEmail) == "" {
		writeError(w, http.StatusBadRequest, "Semua field wajib diisi")
		return
	}
	if !isValidSubdomain(req.Subdomain) || isReservedSubdomain(req.Subdomain) {
		writeError(w, http.StatusBadRequest, "Subdomain tidak valid")
		return
	}
	if req.Region != "jakarta" && req.Region != "singapore" {
		writeError(w, http.StatusBadRequest, "Region tidak didukung")
		return
	}
	plan, err := s.store.GetPlanByCode(r.Context(), req.PlanCode)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Paket tidak ditemukan")
		return
	}
	available, err := s.store.IsSubdomainAvailable(r.Context(), req.Subdomain)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !available {
		writeError(w, http.StatusConflict, "Subdomain tidak tersedia")
		return
	}
	if !looksLikeEmail(req.AdminEmail) {
		writeError(w, http.StatusBadRequest, "Email administrator tidak valid")
		return
	}

	site, job, _, err := s.store.CreateSite(r.Context(), store.CreateSiteParams{
		OwnerUserID: user.ID,
		Name:        strings.TrimSpace(req.Name),
		Subdomain:   req.Subdomain,
		PlanCode:    req.PlanCode,
		Region:      req.Region,
		AdminName:   strings.TrimSpace(req.AdminName),
		AdminEmail:  auth.SanitizeEmail(req.AdminEmail),
		SiteURL:     siteURLForSubdomain(s.cfg, req.Subdomain),
		AdminURL:    adminURLForSubdomain(s.cfg, req.Subdomain),
	}, s.cfg.ProvisioningRuntimeMode, plan, store.HostCapacityPolicy{
		StorageBytesLimit:  s.cfg.HostStorageBudgetBytes,
		CPUMillicoresLimit: s.cfg.HostCPUMillicoresBudget,
		MemoryMiBLimit:     s.cfg.HostMemoryMiBBudget,
	})
	if err != nil {
		if errors.Is(err, store.ErrCapacityExceeded) {
			writeError(w, http.StatusConflict, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	task, err := provisioning.NewProvisionSiteTask(job.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if _, err := s.asynqClient.Enqueue(
		task,
		asynq.Queue("default"),
		asynq.MaxRetry(5),
		asynq.Timeout(20*time.Minute),
		asynq.TaskID("provision-site-"+job.ID.String()),
	); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"site":    site,
		"job":     job,
		"message": "Permintaan pembuatan situs berhasil dibuat",
	})
}

func (s *Server) handleGetSiteByID(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	site, err := s.store.GetSiteByIDForOwner(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"site": site})
}

func (s *Server) handleGetSiteUsage(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	usage, err := s.store.GetSiteUsageBySiteIDForOwner(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Penggunaan situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"usage": usage})
}

func (s *Server) handleGetProvisioningBySiteID(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	status, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Proses provisioning tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handleGetSiteRuntime(w http.ResponseWriter, r *http.Request) {
	s.handleSiteRuntimeAction(w, r, "status")
}

func (s *Server) handleStartSiteRuntime(w http.ResponseWriter, r *http.Request) {
	s.handleSiteRuntimeAction(w, r, "start")
}

func (s *Server) handleRestartSiteRuntime(w http.ResponseWriter, r *http.Request) {
	s.handleSiteRuntimeAction(w, r, "restart")
}

func (s *Server) handleStopSiteRuntime(w http.ResponseWriter, r *http.Request) {
	s.handleSiteRuntimeAction(w, r, "stop")
}

func (s *Server) handleSiteRuntimeAction(w http.ResponseWriter, r *http.Request, action string) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Runtime situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var runtimeStatus provisioning.SiteRuntimeStatus
	switch action {
	case "status":
		runtimeStatus, err = s.runtime.GetRuntimeStatus(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime)
	case "start":
		runtimeStatus, err = s.runtime.StartSite(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime)
	case "restart":
		runtimeStatus, err = s.runtime.RestartSite(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime)
	case "stop":
		runtimeStatus, err = s.runtime.StopSite(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime)
	default:
		writeError(w, http.StatusInternalServerError, "Aksi runtime tidak didukung")
		return
	}
	if err != nil {
		switch {
		case errors.Is(err, provisioning.ErrRuntimeControlUnsupported):
			writeError(w, http.StatusConflict, "Runtime situs tidak mendukung aksi ini")
		case errors.Is(err, provisioning.ErrRuntimeMetadataMissing):
			writeError(w, http.StatusConflict, "Metadata runtime situs belum tersedia")
		case errors.Is(err, provisioning.ErrRuntimeNotControllable):
			writeError(w, http.StatusConflict, "Situs belum siap dikontrol")
		default:
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	s.persistRuntimeHealth(r.Context(), &runtimeStatus)
	writeJSON(w, http.StatusOK, runtimeStatus)
}

func (s *Server) handleGetSiteBySubdomain(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	site, err := s.store.GetSiteBySubdomainForOwner(r.Context(), user.ID, chi.URLParam(r, "subdomain"))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"site": site})
}

func (s *Server) persistRuntimeHealth(ctx context.Context, runtimeStatus *provisioning.SiteRuntimeStatus) {
	if runtimeStatus == nil || runtimeStatus.Runtime == nil {
		return
	}

	healthStatus := strings.TrimSpace(runtimeStatus.OverallStatus)
	if healthStatus == "running" {
		healthStatus = "healthy"
	}
	if healthStatus == "" {
		healthStatus = "unknown"
	}
	runtimeStatus.Runtime.HealthStatus = healthStatus
	runtimeStatus.Runtime.LastHealthError = runtimeStatus.LastError
	now := time.Now().UTC()
	runtimeStatus.Runtime.LastHealthCheckedAt = &now
	if err := s.store.UpdateSiteRuntimeHealth(ctx, runtimeStatus.Site.ID, healthStatus, runtimeStatus.LastError); err != nil {
		log.Printf("persist runtime health error: %v", err)
	}
}

func (s *Server) handleListNotifications(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	notifications, err := s.store.ListNotifications(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"notifications": notifications})
}

func (s *Server) handleMarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	if err := s.store.MarkAllNotificationsRead(r.Context(), user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Semua notifikasi ditandai telah dibaca"})
}

func (s *Server) handleMarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	notificationID, err := uuid.Parse(chi.URLParam(r, "notificationID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Notification ID tidak valid")
		return
	}
	if err := s.store.MarkNotificationRead(r.Context(), user.ID, notificationID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Notifikasi ditandai telah dibaca"})
}

func (s *Server) handleDeleteNotification(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	notificationID, err := uuid.Parse(chi.URLParam(r, "notificationID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Notification ID tidak valid")
		return
	}
	if err := s.store.DeleteNotification(r.Context(), user.ID, notificationID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Notifikasi dihapus"})
}

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
