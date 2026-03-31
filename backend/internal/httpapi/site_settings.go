package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

type siteSettingsResponse struct {
	Site                store.Site                 `json:"site"`
	Runtime             *store.SiteRuntimeMetadata `json:"runtime,omitempty"`
	CustomDomain        siteCustomDomainResponse   `json:"custom_domain"`
	CustomDomainEnabled bool                       `json:"custom_domain_enabled"`
}

type siteCustomDomainResponse struct {
	Supported   bool       `json:"supported"`
	Domain      string     `json:"domain"`
	Status      string     `json:"status"`
	CNAMETarget string     `json:"cname_target"`
	TXTName     string     `json:"txt_name"`
	TXTValue    string     `json:"txt_value"`
	LastError   string     `json:"last_error"`
	VerifiedAt  *time.Time `json:"verified_at,omitempty"`
	ActivatedAt *time.Time `json:"activated_at,omitempty"`
}

func (s *Server) handleGetSiteSettings(w http.ResponseWriter, r *http.Request) {
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

	var runtime *store.SiteRuntimeMetadata
	metadata, err := s.store.GetSiteRuntimeMetadata(r.Context(), site.ID)
	if err != nil {
		if !errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		runtime = &metadata
	}

	customDomain, err := s.siteCustomDomainResponse(r.Context(), site.ID, site)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, siteSettingsResponse{
		Site:                site,
		Runtime:             runtime,
		CustomDomain:        customDomain,
		CustomDomainEnabled: provisioning.CustomDomainSupported(s.cfg),
	})
}

func (s *Server) handleUpdateSite(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "Nama situs wajib diisi")
		return
	}

	site, err := s.store.UpdateSiteName(r.Context(), store.UpdateSiteParams{
		OwnerUserID: user.ID,
		SiteID:      siteID,
		Name:        req.Name,
	})
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"site":    site,
		"message": "Nama situs berhasil diperbarui",
	})
}

func (s *Server) handleUpsertSiteCustomDomain(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	if !provisioning.CustomDomainSupported(s.cfg) {
		writeError(w, http.StatusConflict, "Custom domain belum tersedia di environment ini")
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
	if site.Status != "active" {
		writeError(w, http.StatusConflict, "Situs harus aktif sebelum custom domain dihubungkan")
		return
	}

	var req struct {
		Domain string `json:"domain"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	domain := normalizeCustomDomain(req.Domain)
	if !isValidCustomDomain(domain) {
		writeError(w, http.StatusBadRequest, "Gunakan subdomain lengkap seperti lms.sekolah.sch.id")
		return
	}

	existing, existingErr := s.store.GetSiteCustomDomain(r.Context(), site.ID)
	if existingErr != nil && !errors.Is(existingErr, store.ErrNotFound) {
		writeError(w, http.StatusInternalServerError, existingErr.Error())
		return
	}
	if existingErr == nil && existing.Status == "active" && !strings.EqualFold(existing.Domain, domain) {
		writeError(w, http.StatusConflict, "Hapus custom domain lama terlebih dahulu sebelum mengganti domain")
		return
	}

	token := uuid.NewString()
	if existingErr == nil && strings.EqualFold(existing.Domain, domain) && strings.TrimSpace(existing.VerificationToken) != "" {
		token = existing.VerificationToken
	}

	customDomain := store.SiteCustomDomain{
		SiteID:            site.ID,
		Domain:            domain,
		Status:            "pending_dns",
		VerificationToken: token,
	}

	verifiedAt, lastError := verifyCustomDomainDNS(domain, provisioning.CanonicalSiteHost(s.cfg, site.Subdomain), provisioning.CustomDomainTXTName(domain), token)
	if lastError == "" {
		customDomain.Status = "pending_tls"
		customDomain.VerifiedAt = verifiedAt
	}
	customDomain.LastError = lastError

	upserted, err := s.store.UpsertSiteCustomDomain(r.Context(), store.UpsertSiteCustomDomainParams{
		SiteID:            customDomain.SiteID,
		Domain:            customDomain.Domain,
		Status:            customDomain.Status,
		VerificationToken: customDomain.VerificationToken,
		LastError:         customDomain.LastError,
		VerifiedAt:        customDomain.VerifiedAt,
		ActivatedAt:       nil,
	})
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "Custom domain sudah digunakan oleh situs lain")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if upserted.Status != "pending_tls" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"site":          site,
			"custom_domain": s.buildSiteCustomDomainResponse(site, &upserted),
			"message":       "Custom domain menunggu verifikasi DNS",
		})
		return
	}

	provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, site.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	siteWithDomain := provisioningStatus.Site
	siteWithDomain.SiteURL, siteWithDomain.AdminURL = provisioning.BuildCustomDomainURLs(s.cfg, domain)

	runtimeStatus, err := s.runtime.ReconcileSite(r.Context(), siteWithDomain, provisioningStatus.Job, provisioningStatus.Runtime, &upserted)
	if err != nil {
		failedDomain, persistErr := s.store.UpsertSiteCustomDomain(r.Context(), store.UpsertSiteCustomDomainParams{
			SiteID:            upserted.SiteID,
			Domain:            upserted.Domain,
			Status:            "failed",
			VerificationToken: upserted.VerificationToken,
			LastError:         err.Error(),
			VerifiedAt:        upserted.VerifiedAt,
			ActivatedAt:       nil,
		})
		if persistErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("%s; %s", err.Error(), persistErr.Error()))
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"site":          site,
			"custom_domain": s.buildSiteCustomDomainResponse(site, &failedDomain),
			"message":       "Custom domain gagal diaktifkan",
		})
		return
	}

	updatedSite, err := s.store.UpdateSiteURLs(r.Context(), store.UpdateSiteURLsParams{
		OwnerUserID: user.ID,
		SiteID:      site.ID,
		SiteURL:     siteWithDomain.SiteURL,
		AdminURL:    siteWithDomain.AdminURL,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	now := time.Now().UTC()
	activeDomain, err := s.store.UpsertSiteCustomDomain(r.Context(), store.UpsertSiteCustomDomainParams{
		SiteID:            upserted.SiteID,
		Domain:            upserted.Domain,
		Status:            "active",
		VerificationToken: upserted.VerificationToken,
		LastError:         "",
		VerifiedAt:        upserted.VerifiedAt,
		ActivatedAt:       &now,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.persistRuntimeHealth(r.Context(), &runtimeStatus)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"site":          updatedSite,
		"custom_domain": s.buildSiteCustomDomainResponse(updatedSite, &activeDomain),
		"message":       "Custom domain berhasil diaktifkan",
	})
}

func (s *Server) handleDeleteSiteCustomDomain(w http.ResponseWriter, r *http.Request) {
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

	customDomain, err := s.store.GetSiteCustomDomain(r.Context(), site.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusOK, map[string]string{"message": "Custom domain belum terpasang"})
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	canonicalSite := site
	canonicalSite.SiteURL, canonicalSite.AdminURL = provisioning.BuildSiteURLs(s.cfg, site.Subdomain)

	if customDomainActiveForRemoval(customDomain) {
		provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, site.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		runtimeStatus, err := s.runtime.ReconcileSite(r.Context(), canonicalSite, provisioningStatus.Job, provisioningStatus.Runtime, nil)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		s.persistRuntimeHealth(r.Context(), &runtimeStatus)
	}

	updatedSite, err := s.store.UpdateSiteURLs(r.Context(), store.UpdateSiteURLsParams{
		OwnerUserID: user.ID,
		SiteID:      site.ID,
		SiteURL:     canonicalSite.SiteURL,
		AdminURL:    canonicalSite.AdminURL,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.store.DeleteSiteCustomDomain(r.Context(), site.ID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"site":    updatedSite,
		"message": "Custom domain berhasil dilepas",
	})
}

func (s *Server) handleDeleteSite(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	siteID, err := uuid.Parse(chi.URLParam(r, "siteID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}

	var req struct {
		ConfirmSubdomain string `json:"confirm_subdomain"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(r.Context(), user.ID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if normalizeSubdomain(req.ConfirmSubdomain) != provisioningStatus.Site.Subdomain {
		writeError(w, http.StatusBadRequest, "Konfirmasi subdomain tidak cocok")
		return
	}

	if err := s.runtime.DestroySite(r.Context(), provisioningStatus.Site, provisioningStatus.Job, provisioningStatus.Runtime); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.store.CancelSubscriptionsBySiteID(r.Context(), user.ID, siteID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.store.CancelPendingInvoicesBySiteID(r.Context(), user.ID, siteID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.store.DeleteSiteForOwner(r.Context(), user.ID, siteID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Situs tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Situs berhasil dihapus"})
}

func (s *Server) siteCustomDomainResponse(ctx context.Context, siteID uuid.UUID, site store.Site) (siteCustomDomainResponse, error) {
	customDomain, err := s.store.GetSiteCustomDomain(ctx, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return s.buildSiteCustomDomainResponse(site, nil), nil
		}
		return siteCustomDomainResponse{}, err
	}
	return s.buildSiteCustomDomainResponse(site, &customDomain), nil
}

func (s *Server) buildSiteCustomDomainResponse(site store.Site, customDomain *store.SiteCustomDomain) siteCustomDomainResponse {
	response := siteCustomDomainResponse{
		Supported:   provisioning.CustomDomainSupported(s.cfg),
		CNAMETarget: provisioning.CanonicalSiteHost(s.cfg, site.Subdomain),
	}
	if customDomain == nil {
		return response
	}
	response.Domain = strings.TrimSpace(customDomain.Domain)
	response.Status = strings.TrimSpace(customDomain.Status)
	response.TXTName = provisioning.CustomDomainTXTName(customDomain.Domain)
	response.TXTValue = strings.TrimSpace(customDomain.VerificationToken)
	response.LastError = strings.TrimSpace(customDomain.LastError)
	response.VerifiedAt = customDomain.VerifiedAt
	response.ActivatedAt = customDomain.ActivatedAt
	return response
}

func normalizeCustomDomain(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.TrimSuffix(value, ".")
	return value
}

func isValidCustomDomain(value string) bool {
	if value == "" || len(value) > 253 || strings.Contains(value, "/") || strings.Contains(value, ":") {
		return false
	}
	if net.ParseIP(value) != nil {
		return false
	}
	parts := strings.Split(value, ".")
	if len(parts) < 3 {
		return false
	}
	for _, part := range parts {
		if part == "" || len(part) > 63 || strings.HasPrefix(part, "-") || strings.HasSuffix(part, "-") {
			return false
		}
		for _, r := range part {
			switch {
			case r >= 'a' && r <= 'z':
			case r >= '0' && r <= '9':
			case r == '-':
			default:
				return false
			}
		}
	}
	return true
}

func verifyCustomDomainDNS(domain, cnameTarget, txtName, txtValue string) (*time.Time, string) {
	cnameMatch, cnameErr := customDomainCNAMEMatches(domain, cnameTarget)
	if cnameErr != nil || !cnameMatch {
		return nil, fmt.Sprintf("CNAME %s harus mengarah ke %s", domain, cnameTarget)
	}
	txtMatch, txtErr := customDomainTXTMatches(txtName, txtValue)
	if txtErr != nil || !txtMatch {
		return nil, fmt.Sprintf("TXT %s harus berisi %s", txtName, txtValue)
	}
	now := time.Now().UTC()
	return &now, ""
}

func customDomainCNAMEMatches(domain, expectedTarget string) (bool, error) {
	target, err := net.LookupCNAME(domain)
	if err != nil {
		return false, err
	}
	return normalizeDNSName(target) == normalizeDNSName(expectedTarget), nil
}

func customDomainTXTMatches(name, expectedValue string) (bool, error) {
	records, err := net.LookupTXT(name)
	if err != nil {
		return false, err
	}
	for _, record := range records {
		if strings.TrimSpace(record) == strings.TrimSpace(expectedValue) {
			return true, nil
		}
	}
	return false, nil
}

func normalizeDNSName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	return strings.TrimSuffix(value, ".")
}

func customDomainActiveForRemoval(customDomain store.SiteCustomDomain) bool {
	switch strings.TrimSpace(customDomain.Status) {
	case "pending_tls", "active":
		return strings.TrimSpace(customDomain.Domain) != ""
	default:
		return false
	}
}
