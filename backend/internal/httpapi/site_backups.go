package httpapi

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	backupstore "moodlepilot/backend/internal/backup"
	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

type siteBackupsResponse struct {
	Settings store.SiteBackupSettings `json:"settings"`
	Backups  []store.SiteBackup       `json:"backups"`
}

func (s *Server) handleGetSiteBackups(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	settings, backups, err := s.store.GetSiteBackupHistoryWithSettingsForOwner(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteBackupsResponse{
		Settings: settings,
		Backups:  backups,
	})
}

func (s *Server) handleCreateSiteBackup(w http.ResponseWriter, r *http.Request) {
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
	if strings.TrimSpace(site.Status) != "active" {
		writeError(w, http.StatusConflict, "Situs harus aktif sebelum backup dijalankan")
		return
	}

	settings, err := s.store.GetSiteBackupSettings(r.Context(), siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Pengaturan backup situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Status provisioning situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if strings.TrimSpace(provisioningStatus.Job.RuntimeMode) != "docker_local" {
		writeError(w, http.StatusConflict, "Backup hanya tersedia untuk runtime docker_local")
		return
	}
	if provisioningStatus.Runtime == nil {
		writeError(w, http.StatusConflict, "Metadata runtime situs belum tersedia")
		return
	}

	backup, err := provisioning.EnqueueSiteBackup(r.Context(), s.store, s.asynqClient, site, "manual", settings.RetentionDays)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "Backup lain sedang berjalan untuk situs ini")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]any{
		"backup":  backup,
		"message": "Backup sedang diproses",
	})
}

func (s *Server) handleUpdateSiteBackupSettings(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	var req struct {
		Enabled       bool   `json:"enabled"`
		Frequency     string `json:"frequency"`
		RetentionDays int    `json:"retention_days"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	frequency := strings.ToLower(strings.TrimSpace(req.Frequency))
	switch frequency {
	case store.SiteBackupFrequencyDaily, store.SiteBackupFrequencyWeekly, store.SiteBackupFrequencyMonthly:
	default:
		writeError(w, http.StatusBadRequest, "Frekuensi backup tidak valid")
		return
	}
	switch req.RetentionDays {
	case 7, 30, 90:
	default:
		writeError(w, http.StatusBadRequest, "Retensi backup tidak valid")
		return
	}

	settings, err := s.store.UpdateSiteBackupSettings(r.Context(), store.UpdateSiteBackupSettingsParams{
		OwnerUserID:   user.ID,
		SiteID:        siteID,
		Enabled:       req.Enabled,
		Frequency:     frequency,
		RetentionDays: req.RetentionDays,
	})
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"settings": settings,
		"message":  "Pengaturan backup berhasil diperbarui",
	})
}

func (s *Server) handleDownloadSiteBackup(w http.ResponseWriter, r *http.Request) {
	if s.backupStore == nil {
		writeError(w, http.StatusServiceUnavailable, "Storage backup belum tersedia")
		return
	}

	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	backupID, err := uuid.Parse(chi.URLParam(r, "backupID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Backup ID tidak valid")
		return
	}

	backup, err := s.store.GetSiteBackupForOwner(r.Context(), user.ID, siteID, backupID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Backup tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if strings.TrimSpace(backup.Status) != "completed" || strings.TrimSpace(backup.ObjectKey) == "" {
		writeError(w, http.StatusConflict, "Backup belum siap diunduh")
		return
	}

	body, err := s.backupStore.GetObject(r.Context(), backup.ObjectKey)
	if err != nil {
		if errors.Is(err, backupstore.ErrObjectNotFound) {
			writeError(w, http.StatusNotFound, "File backup tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer body.Close()

	filename := siteBackupFilename(backup)
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	if backup.SizeBytes > 0 {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", backup.SizeBytes))
	}
	if _, err := io.Copy(w, body); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func siteBackupFilename(backup store.SiteBackup) string {
	stamp := backup.CreatedAt
	if backup.CompletedAt != nil {
		stamp = *backup.CompletedAt
	}
	return fmt.Sprintf("site-backup-%s-%s.tar.gz", backup.SiteSubdomain, stamp.Format("20060102-150405"))
}
