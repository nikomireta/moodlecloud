package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

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

	if err := h.runStep(ctx, jobID, "provision", 15, func(ctx context.Context) error {
		metadata, err := h.Runtime.Provision(ctx, site)
		if err != nil {
			return err
		}
		runtimeMetadata = &metadata
		_, err = h.Store.UpsertSiteRuntimeMetadata(ctx, store.UpsertSiteRuntimeMetadataParams{
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

	if err := h.runStep(ctx, jobID, "database", 35, func(ctx context.Context) error {
		return h.Runtime.CreateDatabase(ctx, site, *runtimeMetadata)
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "database", err)
	}

	if err := h.runStep(ctx, jobID, "install", 60, func(ctx context.Context) error {
		return h.Runtime.Install(ctx, site, *runtimeMetadata)
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "install", err)
	}

	if err := h.runStep(ctx, jobID, "ssl", 85, func(ctx context.Context) error {
		return h.Runtime.ValidateRoute(ctx, site, *runtimeMetadata)
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "ssl", err)
	}

	if err := h.runStep(ctx, jobID, "finalize", 100, func(ctx context.Context) error {
		if err := h.Runtime.Finalize(ctx, site, *runtimeMetadata); err != nil {
			return err
		}
		return h.Store.UpdateSiteRuntimeHealth(ctx, site.ID, "healthy", "")
	}); err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "finalize", err)
	}

	site, err = h.Store.ActivateProvisioningJob(ctx, jobID)
	if err != nil {
		return h.failJob(ctx, jobID, site, runtimeMetadata, "finalize", err)
	}

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

func (h Handler) runStep(ctx context.Context, jobID uuid.UUID, stepID string, percent int, fn func(context.Context) error) error {
	if err := h.Store.StartProvisioningStep(ctx, jobID, stepID, percent); err != nil {
		return err
	}
	if err := fn(ctx); err != nil {
		return err
	}
	return h.Store.CompleteProvisioningStep(ctx, jobID, stepID, percent)
}

func (h Handler) failJob(ctx context.Context, jobID uuid.UUID, site store.Site, runtimeMetadata *store.SiteRuntimeMetadata, stepID string, original error) error {
	if runtimeMetadata != nil {
		_ = h.Runtime.Cleanup(ctx, site, runtimeMetadata, stepID)
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
