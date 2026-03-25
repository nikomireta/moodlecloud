package httpapi

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/auth"
	"moodlepilot/backend/internal/store"
)

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
