package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"moodlepilot/backend/internal/config"
	"moodlepilot/backend/internal/store"
)

var (
	ErrRuntimeControlUnsupported = errors.New("site runtime control unsupported")
	ErrRuntimeMetadataMissing    = errors.New("site runtime metadata missing")
	ErrRuntimeNotControllable    = errors.New("site runtime is not controllable")
)

type SiteRuntimeService struct {
	Name          string     `json:"name"`
	ContainerName string     `json:"container_name"`
	State         string     `json:"state"`
	HealthStatus  string     `json:"health_status"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	FinishedAt    *time.Time `json:"finished_at,omitempty"`
	StatusText    string     `json:"status_text"`
}

type SiteSystemSummary struct {
	MoodleVersion string `json:"moodle_version"`
	PHPVersion    string `json:"php_version"`
	DatabaseLabel string `json:"database_label"`
}

type SiteRuntimeStatus struct {
	Site          store.Site                 `json:"site"`
	RuntimeMode   string                     `json:"runtime_mode"`
	Controllable  bool                       `json:"controllable"`
	OverallStatus string                     `json:"overall_status"`
	LastError     string                     `json:"last_error"`
	Services      []SiteRuntimeService       `json:"services"`
	Runtime       *store.SiteRuntimeMetadata `json:"runtime,omitempty"`
	System        *SiteSystemSummary         `json:"system,omitempty"`
}

type Runtime interface {
	Provision(ctx context.Context, site store.Site) (store.SiteRuntimeMetadata, error)
	CreateDatabase(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error
	Install(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error
	ValidateRoute(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error
	Finalize(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error
	Cleanup(ctx context.Context, site store.Site, metadata *store.SiteRuntimeMetadata, failedStep string) error
	GetRuntimeStatus(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error)
	StartSite(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error)
	RestartSite(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error)
	StopSite(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error)
	ReconcileSite(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata, customDomain *store.SiteCustomDomain) (SiteRuntimeStatus, error)
	DestroySite(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) error
}

func NewRuntime(cfg config.Config) (Runtime, error) {
	switch strings.TrimSpace(cfg.ProvisioningRuntimeMode) {
	case "", "simulated":
		return SimulatedRuntime{Config: cfg}, nil
	case "docker_local":
		return NewDockerLocalRuntime(cfg)
	default:
		return nil, fmt.Errorf("unsupported provisioning runtime mode: %s", cfg.ProvisioningRuntimeMode)
	}
}

func BuildSiteURLs(cfg config.Config, subdomain string) (string, string) {
	return BuildHostURLs(cfg, fmt.Sprintf("%s.%s", strings.TrimSpace(subdomain), siteBaseDomain(cfg)))
}

func BuildHostURLs(cfg config.Config, host string) (string, string) {
	scheme := strings.TrimSpace(cfg.SiteURLScheme)
	if scheme == "" {
		scheme = "http"
	}
	host = strings.TrimSpace(host)
	siteURL := fmt.Sprintf("%s://%s", scheme, host)
	return siteURL, siteURL + "/admin"
}

func siteBaseDomain(cfg config.Config) string {
	baseDomain := strings.TrimSpace(cfg.SiteBaseDomain)
	if baseDomain == "" {
		baseDomain = "lvh.me"
	}
	return baseDomain
}

func CanonicalSiteHost(cfg config.Config, subdomain string) string {
	return fmt.Sprintf("%s.%s", strings.TrimSpace(subdomain), siteBaseDomain(cfg))
}

func BuildCustomDomainURLs(cfg config.Config, domain string) (string, string) {
	return BuildHostURLs(cfg, strings.TrimSpace(domain))
}

func CustomDomainSupported(cfg config.Config) bool {
	return cfg.CustomDomainEnabled && strings.TrimSpace(cfg.TraefikACMEResolver) != ""
}

func CustomDomainTXTName(domain string) string {
	domain = strings.Trim(strings.TrimSpace(domain), ".")
	if domain == "" {
		return ""
	}
	return fmt.Sprintf("_moodlepilot-verify.%s", domain)
}

func customDomainActiveForRouting(customDomain *store.SiteCustomDomain) bool {
	if customDomain == nil {
		return false
	}
	switch strings.TrimSpace(customDomain.Status) {
	case "pending_tls", "active":
		return strings.TrimSpace(customDomain.Domain) != ""
	default:
		return false
	}
}

func BuildRuntimeMetadata(cfg config.Config, site store.Site) store.SiteRuntimeMetadata {
	shortID := strings.ReplaceAll(site.ID.String()[:8], "-", "")
	resourceSlug := sanitizeResourceSlug(site.Subdomain)
	resourceTail := truncateResourceSegment(resourceSlug, 24)
	resourceName := fmt.Sprintf("%s-%s", resourceTail, shortID)
	databaseSlug := truncateResourceSegment(strings.ReplaceAll(resourceSlug, "-", "_"), 16)

	return store.SiteRuntimeMetadata{
		SiteID:            site.ID,
		ImageRepository:   strings.TrimSpace(cfg.MoodleImageRepository),
		ImageTag:          strings.TrimSpace(cfg.MoodleImageTag),
		WebContainerName:  fmt.Sprintf("mc-web-%s", resourceName),
		CronContainerName: fmt.Sprintf("mc-cron-%s", resourceName),
		VolumeName:        fmt.Sprintf("mc-data-%s", resourceName),
		DatabaseName:      fmt.Sprintf("mc_%s_%s", databaseSlug, shortID),
		DatabaseUser:      fmt.Sprintf("mc_u_%s_%s", databaseSlug, shortID),
		HealthStatus:      "unknown",
	}
}

func InitialAdminPassword(secret string, siteID string) string {
	return derivedPassword(secret, "admin", siteID, "Mc!")
}

func DatabasePassword(secret string, siteID string) string {
	return derivedPassword(secret, "database", siteID, "Db!")
}

func derivedPassword(secret, scope, siteID, prefix string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(secret) + ":" + scope + ":" + strings.TrimSpace(siteID)))
	token := base64.RawURLEncoding.EncodeToString(sum[:])
	token = strings.ReplaceAll(token, "-", "A")
	token = strings.ReplaceAll(token, "_", "b")
	if len(token) > 18 {
		token = token[:18]
	}
	return prefix + token + "9a"
}

func sanitizeResourceSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	lastDash := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
			lastDash = false
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
			lastDash = false
		case r == '-' && !lastDash:
			builder.WriteRune(r)
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func truncateResourceSegment(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return strings.Trim(value[:limit], "-_")
}

func BuildMinimalRuntimeStatus(site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) SiteRuntimeStatus {
	lastError := strings.TrimSpace(site.LastError)
	if lastError == "" {
		lastError = strings.TrimSpace(job.LastError)
	}
	if lastError == "" && metadata != nil {
		lastError = strings.TrimSpace(metadata.LastHealthError)
	}

	overallStatus := "unknown"
	switch strings.TrimSpace(strings.ToLower(site.Status)) {
	case "pending", "provisioning":
		overallStatus = "provisioning"
	case "failed":
		overallStatus = "failed"
	case "active":
		overallStatus = minimalOverallStatus(metadata)
	}

	return SiteRuntimeStatus{
		Site:          site,
		RuntimeMode:   strings.TrimSpace(job.RuntimeMode),
		Controllable:  false,
		OverallStatus: overallStatus,
		LastError:     lastError,
		Runtime:       metadata,
		Services:      []SiteRuntimeService{},
	}
}

func minimalOverallStatus(metadata *store.SiteRuntimeMetadata) string {
	if metadata == nil {
		return "unknown"
	}

	switch strings.TrimSpace(strings.ToLower(metadata.HealthStatus)) {
	case "healthy", "running":
		return "running"
	case "degraded":
		return "degraded"
	case "stopped":
		return "stopped"
	case "failed":
		return "failed"
	default:
		return "unknown"
	}
}
