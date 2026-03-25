package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/store"
)

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
