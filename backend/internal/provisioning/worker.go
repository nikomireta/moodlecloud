package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"moodlepilot/backend/internal/mail"
	"moodlepilot/backend/internal/store"
)

type Handler struct {
	Store             *store.Store
	Mailer            mail.Mailer
	Runtime           Runtime
	SiteDBAdminURL    string
	SiteRuntimeSecret string
	RedisAddr         string
	RedisPassword     string
}

func (h Handler) HandleProvisionSiteTask(ctx context.Context, task *asynq.Task) error {
	var payload TaskPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("decode task payload: %w", err)
	}

	jobID, err := uuid.Parse(payload.JobID)
	if err != nil {
		return fmt.Errorf("parse job id: %w", err)
	}

	site, _, runtimeMetadata, err := h.Store.GetProvisioningContextByJobID(ctx, jobID)
	if err != nil {
		return fmt.Errorf("load provisioning context: %w", err)
	}

	// On retry attempts, reset any previously-failed step events back to
	// pending so the frontend progress UI shows a clean slate and the
	// worker can re-run from the beginning.
	if err := h.Store.ResetProvisioningSteps(ctx, jobID); err != nil {
		log.Printf("provisioning: warning: could not reset step events job=%s: %v", jobID, err)
	}

	log.Printf("provisioning: starting job=%s site=%s", jobID, site.Subdomain)

	if err := h.runStep(ctx, jobID, "provision", 15, func(stepCtx context.Context) error {
		metadata, err := h.Runtime.Provision(stepCtx, site)
		if err != nil {
			return err
		}
		runtimeMetadata = &metadata
		_, err = h.Store.UpsertSiteRuntimeMetadata(stepCtx, store.UpsertSiteRuntimeMetadataParams{
			SiteID:            metadata.SiteID,
			ImageRepository:   metadata.ImageRepository,
			ImageTag:          metadata.ImageTag,
			WebContainerName:  metadata.WebContainerName,
			CronContainerName: metadata.CronContainerName,
			VolumeName:        metadata.VolumeName,
			DatabaseName:      metadata.DatabaseName,
			DatabaseUser:      metadata.DatabaseUser,
			HealthStatus:      metadata.HealthStatus,
			LastHealthError:   metadata.LastHealthError,
		})
		return err
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "provision", err)
	}

	if runtimeMetadata == nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "provision", errors.New("runtime metadata belum tersedia"))
	}

	if err := h.runStep(ctx, jobID, "database", 35, func(stepCtx context.Context) error {
		return h.Runtime.CreateDatabase(stepCtx, site, *runtimeMetadata)
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "database", err)
	}

	if err := h.runStep(ctx, jobID, "install", 60, func(stepCtx context.Context) error {
		return h.Runtime.Install(stepCtx, site, *runtimeMetadata)
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "install", err)
	}

	if err := h.runStep(ctx, jobID, "ssl", 85, func(stepCtx context.Context) error {
		return h.Runtime.ValidateRoute(stepCtx, site, *runtimeMetadata)
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "ssl", err)
	}

	if err := h.runStep(ctx, jobID, "finalize", 100, func(stepCtx context.Context) error {
		if err := h.Runtime.Finalize(stepCtx, site, *runtimeMetadata); err != nil {
			return err
		}
		return h.Store.UpdateSiteRuntimeHealth(stepCtx, site.ID, "healthy", "")
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "finalize", err)
	}

	site, err = h.Store.ActivateProvisioningJob(ctx, jobID)
	if err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "finalize", err)
	}

	log.Printf("provisioning: completed job=%s site=%s", jobID, site.Subdomain)

	if _, err := h.Store.CreateNotification(ctx, store.CreateNotificationParams{
		UserID:    site.OwnerUserID,
		Type:      "success",
		Category:  "deployment",
		Title:     "Situs berhasil dibuat",
		Message:   fmt.Sprintf("Situs %s telah aktif dan siap digunakan.", site.SiteURL),
		ActionURL: fmt.Sprintf("/situs/%s", site.Subdomain),
	}); err != nil {
		return fmt.Errorf("create site-ready notification: %w", err)
	}

	if err := h.Mailer.SendSiteReady(site, InitialAdminPassword(h.SiteRuntimeSecret, site.ID.String())); err != nil {
		return fmt.Errorf("send site ready mail: %w", err)
	}
	return nil
}

// runStep executes a provisioning step with a per-step context timeout.
// The step function receives a child context that will be cancelled if the
// step exceeds its allowed duration, preventing indefinite blocking on
// hung Docker operations or network calls.
func (h Handler) runStep(ctx context.Context, jobID uuid.UUID, stepID string, percent int, fn func(context.Context) error) error {
	if err := h.Store.StartProvisioningStep(ctx, jobID, stepID, percent); err != nil {
		return err
	}

	timeout := stepTimeout(stepID)
	stepCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	log.Printf("provisioning: step=%s started job=%s timeout=%s", stepID, jobID, timeout)

	if err := fn(stepCtx); err != nil {
		if stepCtx.Err() != nil && ctx.Err() == nil {
			// The step context timed out but the parent context is still
			// alive — this is a per-step timeout, not an Asynq-level
			// cancellation.
			return fmt.Errorf("step %s timed out after %s: %w", stepID, timeout, err)
		}
		return err
	}

	log.Printf("provisioning: step=%s completed job=%s", stepID, jobID)
	return h.Store.CompleteProvisioningStep(ctx, jobID, stepID, percent)
}

func (h Handler) failJob(ctx context.Context, jobID uuid.UUID, site store.Site, runtimeMetadata *store.SiteRuntimeMetadata, stepID string, original error) error {
	log.Printf("provisioning: failed job=%s site=%s step=%s error=%v", jobID, site.Subdomain, stepID, original)

	if runtimeMetadata != nil {
		// Use a fresh context for cleanup since the step context may have
		// been cancelled. Give cleanup a generous 2-minute deadline.
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		if err := h.Runtime.Cleanup(cleanupCtx, site, runtimeMetadata, stepID); err != nil {
			log.Printf("provisioning: cleanup error job=%s site=%s step=%s: %v", jobID, site.Subdomain, stepID, err)
		}
		_ = h.Store.UpdateSiteRuntimeHealth(ctx, site.ID, "failed", original.Error())
	}
	site, err := h.Store.FailProvisioningJob(ctx, jobID, stepID, original.Error())
	if err == nil {
		_, _ = h.Store.CreateNotification(ctx, store.CreateNotificationParams{
			UserID:    site.OwnerUserID,
			Type:      "error",
			Category:  "deployment",
			Title:     "Pembuatan situs gagal",
			Message:   fmt.Sprintf("Situs %s gagal diproses pada langkah %s.", site.Subdomain, stepID),
			ActionURL: fmt.Sprintf("/proses-pembuatan/%s", site.Subdomain),
		})
	}
	return fmt.Errorf("provisioning failed on %s: %w", stepID, original)
}
