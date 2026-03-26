package provisioning

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/hibiken/asynq"

	"moodlepilot/backend/internal/store"
)

const TaskTypeHealthCheckSweep = "health:check-sweep"

// NewHealthCheckSweepTask creates a periodic task that checks the health of
// all active site containers and auto-restarts crashed ones.
func NewHealthCheckSweepTask() *asynq.Task {
	return asynq.NewTask(TaskTypeHealthCheckSweep, nil)
}

// HandleHealthCheckSweepTask iterates over all provisioned sites, inspects
// their container state, updates the health status in the database, and
// attempts to restart containers that have stopped unexpectedly.
func (h Handler) HandleHealthCheckSweepTask(ctx context.Context, _ *asynq.Task) error {
	contexts, err := h.Store.ListProvisioningContextsForUsageMetering(ctx)
	if err != nil {
		return fmt.Errorf("list sites for health check: %w", err)
	}

	for _, item := range contexts {
		if item.Runtime == nil {
			continue
		}
		if strings.TrimSpace(item.Site.Status) != "active" {
			continue
		}

		status, err := h.Runtime.GetRuntimeStatus(ctx, item.Site, item.Job, item.Runtime)
		if err != nil {
			log.Printf("health-check: error inspecting site=%s: %v", item.Site.Subdomain, err)
			_ = h.Store.UpdateSiteRuntimeHealth(ctx, item.Site.ID, "unknown", err.Error())
			continue
		}

		previousHealth := strings.TrimSpace(item.Runtime.HealthStatus)
		previousHealthError := strings.TrimSpace(item.Runtime.LastHealthError)
		newHealth := mapOverallStatusToHealth(status.OverallStatus)

		// Auto-restart stopped or crashed containers.
		// Abaikan auto-restart jika status sebelumnya adalah 'stopped' (dihentikan manual oleh user).
		if shouldAutoRestart(status) && previousHealth != "stopped" {
			log.Printf("health-check: auto-restarting site=%s overall=%s", item.Site.Subdomain, status.OverallStatus)
			if _, restartErr := h.Runtime.StartSite(ctx, item.Site, item.Job, item.Runtime); restartErr != nil {
				log.Printf("health-check: auto-restart failed site=%s: %v", item.Site.Subdomain, restartErr)
				_ = h.Store.UpdateSiteRuntimeHealth(ctx, item.Site.ID, "failed", restartErr.Error())
				h.notifyHealthDegraded(ctx, item.Site, "Container berhenti dan gagal di-restart otomatis")
				continue
			}
			log.Printf("health-check: auto-restart succeeded site=%s", item.Site.Subdomain)
			_ = h.Store.UpdateSiteRuntimeHealth(ctx, item.Site.ID, "healthy", "")
			continue
		}

		healthError := status.LastError
		if newHealth == "healthy" {
			healthError = ""
		}

		// Update stored health state whenever the status or explanatory detail changes.
		if newHealth != previousHealth || healthError != previousHealthError {
			_ = h.Store.UpdateSiteRuntimeHealth(ctx, item.Site.ID, newHealth, healthError)

			if newHealth == "degraded" || newHealth == "failed" {
				h.notifyHealthDegraded(ctx, item.Site, status.LastError)
			}
		}
	}

	return nil
}

func (h Handler) notifyHealthDegraded(ctx context.Context, site store.Site, detail string) {
	message := fmt.Sprintf("Situs %s mengalami masalah kesehatan.", site.Subdomain)
	if detail != "" {
		message = fmt.Sprintf("%s Detail: %s", message, detail)
	}
	_, _ = h.Store.CreateNotification(ctx, store.CreateNotificationParams{
		UserID:    site.OwnerUserID,
		Type:      "warning",
		Category:  "deployment",
		Title:     "Masalah kesehatan situs",
		Message:   message,
		ActionURL: fmt.Sprintf("/situs/%s", site.Subdomain),
	})
}

// shouldAutoRestart returns true if the site's containers have stopped
// unexpectedly and should be restarted automatically.
func shouldAutoRestart(status SiteRuntimeStatus) bool {
	switch strings.TrimSpace(strings.ToLower(status.OverallStatus)) {
	case "stopped", "unknown":
		// Check if any service is in a stopped/missing state.
		for _, svc := range status.Services {
			state := strings.TrimSpace(strings.ToLower(svc.State))
			if state == "exited" || state == "dead" || state == "missing" {
				return true
			}
		}
	}
	return false
}

func mapOverallStatusToHealth(overallStatus string) string {
	switch strings.TrimSpace(strings.ToLower(overallStatus)) {
	case "running":
		return "healthy"
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
