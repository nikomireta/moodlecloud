package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"

	"moodlecloud/backend/internal/config"
	"moodlecloud/backend/internal/store"
)

type Runtime interface {
	Provision(ctx context.Context, site store.Site) (store.SiteRuntimeMetadata, error)
	CreateDatabase(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error
	Install(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error
	ValidateRoute(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error
	Finalize(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error
	Cleanup(ctx context.Context, site store.Site, metadata *store.SiteRuntimeMetadata, failedStep string) error
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
	scheme := strings.TrimSpace(cfg.SiteURLScheme)
	if scheme == "" {
		scheme = "http"
	}
	baseDomain := strings.TrimSpace(cfg.SiteBaseDomain)
	if baseDomain == "" {
		baseDomain = "lvh.me"
	}
	host := fmt.Sprintf("%s.%s", strings.TrimSpace(subdomain), baseDomain)
	siteURL := fmt.Sprintf("%s://%s", scheme, host)
	return siteURL, siteURL + "/admin"
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
