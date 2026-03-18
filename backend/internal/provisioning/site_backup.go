package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"moodlepilot/backend/internal/store"
)

func EnqueueSiteBackup(ctx context.Context, st *store.Store, client *asynq.Client, site store.Site, trigger string, retentionDays int) (store.SiteBackup, error) {
	backup, err := st.CreatePendingSiteBackup(ctx, store.CreateSiteBackupParams{
		Site:          site,
		Trigger:       trigger,
		RetentionDays: retentionDays,
	})
	if err != nil {
		return store.SiteBackup{}, err
	}

	task, err := NewSiteBackupTask(backup.ID)
	if err != nil {
		_, _ = st.FailSiteBackup(ctx, backup.ID, err.Error())
		return store.SiteBackup{}, fmt.Errorf("create site backup task: %w", err)
	}

	taskID := "site-backup-" + backup.ID.String()
	if _, err := client.Enqueue(
		task,
		asynq.Queue("default"),
		asynq.MaxRetry(0),
		asynq.Timeout(45*time.Minute),
		asynq.TaskID(taskID),
	); err != nil {
		_, _ = st.FailSiteBackup(ctx, backup.ID, err.Error())
		return store.SiteBackup{}, fmt.Errorf("enqueue site backup: %w", err)
	}

	return backup, nil
}

func (h Handler) HandleSiteBackupTask(ctx context.Context, task *asynq.Task) error {
	if h.BackupStorage == nil {
		return fmt.Errorf("backup storage belum tersedia")
	}

	var payload SiteBackupTaskPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("decode site backup task payload: %w", err)
	}

	backupID, err := uuid.Parse(payload.BackupID)
	if err != nil {
		return fmt.Errorf("parse backup id: %w", err)
	}

	backup, err := h.Store.StartSiteBackup(ctx, backupID)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			log.Printf("backup: skip start backup=%s because status is no longer pending", backupID)
			return nil
		}
		return fmt.Errorf("start site backup: %w", err)
	}

	execCtx, err := h.Store.GetSiteBackupExecutionContext(ctx, backup.ID)
	if err != nil {
		return h.failSiteBackupTask(ctx, backup, fmt.Errorf("load site backup context: %w", err))
	}
	if strings.TrimSpace(execCtx.Site.Status) != "active" {
		return h.failSiteBackupTask(ctx, backup, fmt.Errorf("situs harus aktif sebelum backup dijalankan"))
	}
	if strings.TrimSpace(execCtx.Job.RuntimeMode) != "docker_local" {
		return h.failSiteBackupTask(ctx, backup, fmt.Errorf("backup hanya tersedia untuk runtime docker_local"))
	}
	if execCtx.Runtime == nil {
		return h.failSiteBackupTask(ctx, backup, fmt.Errorf("metadata runtime situs belum tersedia"))
	}

	dockerRuntime, ok := h.Runtime.(*DockerLocalRuntime)
	if !ok {
		return h.failSiteBackupTask(ctx, backup, fmt.Errorf("runtime backup tidak didukung di environment ini"))
	}

	archivePath, cleanup, err := dockerRuntime.CreateSiteBackupArchive(ctx, execCtx.Site, execCtx.Job, *execCtx.Runtime, backup)
	if err != nil {
		return h.failSiteBackupTask(ctx, backup, err)
	}
	if cleanup != nil {
		defer cleanup()
	}

	sizeBytes, sha256Value, err := fileDigest(archivePath)
	if err != nil {
		return h.failSiteBackupTask(ctx, backup, fmt.Errorf("hitung checksum backup: %w", err))
	}

	archiveFile, err := os.Open(archivePath)
	if err != nil {
		return h.failSiteBackupTask(ctx, backup, fmt.Errorf("buka archive backup: %w", err))
	}
	defer archiveFile.Close()

	objectKey := fmt.Sprintf("sites/%s/%s/site-backup.tar.gz", execCtx.Site.ID, backup.ID)
	if err := h.BackupStorage.PutObject(ctx, objectKey, archiveFile, sizeBytes, "application/gzip"); err != nil {
		return h.failSiteBackupTask(ctx, backup, err)
	}

	completedAt := time.Now().UTC()
	completedBackup, err := h.Store.CompleteSiteBackup(ctx, backup.ID, objectKey, sizeBytes, sha256Value, completedAt)
	if err != nil {
		return fmt.Errorf("complete site backup: %w", err)
	}

	h.notifySiteBackupSuccess(ctx, completedBackup)
	return nil
}

func (h Handler) HandleBackupScheduleSweepTask(ctx context.Context, _ *asynq.Task) error {
	candidates, err := h.Store.ListDueSiteBackups(ctx, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("list due site backups: %w", err)
	}

	client := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     h.RedisAddr,
		Password: h.RedisPassword,
	})
	defer client.Close()

	now := time.Now().UTC()
	for _, candidate := range candidates {
		if !siteBackupDue(candidate.Settings.Frequency, candidate.LastSuccessfulBackupAt, now) {
			continue
		}
		if candidate.Runtime == nil {
			log.Printf("backup: skip scheduled backup for site=%s because runtime metadata is missing", candidate.Site.Subdomain)
			continue
		}
		if _, err := EnqueueSiteBackup(ctx, h.Store, client, candidate.Site, "scheduled", candidate.Settings.RetentionDays); err != nil {
			if errors.Is(err, store.ErrConflict) {
				continue
			}
			log.Printf("backup: failed to enqueue scheduled backup for site=%s: %v", candidate.Site.Subdomain, err)
		}
	}

	return nil
}

func (h Handler) HandleBackupRetentionSweepTask(ctx context.Context, _ *asynq.Task) error {
	expired, err := h.Store.ListExpiredSiteBackups(ctx, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("list expired site backups: %w", err)
	}

	for _, item := range expired {
		if h.BackupStorage != nil {
			if err := h.BackupStorage.DeleteObject(ctx, item.ObjectKey); err != nil {
				log.Printf("backup: failed to delete expired object backup=%s key=%s: %v", item.ID, item.ObjectKey, err)
				continue
			}
		}
		if err := h.Store.DeleteSiteBackupRecord(ctx, item.ID); err != nil {
			log.Printf("backup: failed to delete expired record backup=%s: %v", item.ID, err)
			continue
		}
	}

	return nil
}

func (h Handler) failSiteBackupTask(ctx context.Context, backup store.SiteBackup, original error) error {
	log.Printf("backup: failed backup=%s site=%s error=%v", backup.ID, backup.SiteSubdomain, original)

	failedBackup, err := h.Store.FailSiteBackup(ctx, backup.ID, original.Error())
	if err != nil {
		return fmt.Errorf("mark site backup failed: %w", errors.Join(original, err))
	}

	h.notifySiteBackupFailure(ctx, failedBackup)
	return fmt.Errorf("site backup failed: %w", original)
}

func (h Handler) notifySiteBackupSuccess(ctx context.Context, backup store.SiteBackup) {
	triggerLabel := humanizeSiteBackupTrigger(backup.Trigger)
	message := fmt.Sprintf("Backup %s untuk situs %s berhasil disimpan.", strings.ToLower(triggerLabel), backup.SiteSubdomain)
	_, _ = h.Store.CreateNotification(ctx, store.CreateNotificationParams{
		UserID:    backup.OwnerUserID,
		Type:      "success",
		Category:  "backup",
		Title:     "Backup selesai",
		Message:   message,
		ActionURL: siteBackupActionURL(backup.SiteSubdomain),
	})
}

func (h Handler) notifySiteBackupFailure(ctx context.Context, backup store.SiteBackup) {
	triggerLabel := humanizeSiteBackupTrigger(backup.Trigger)
	message := fmt.Sprintf("Backup %s untuk situs %s gagal diproses.", strings.ToLower(triggerLabel), backup.SiteSubdomain)
	if detail := strings.TrimSpace(backup.LastError); detail != "" {
		message = fmt.Sprintf("%s Detail: %s", message, detail)
	}
	_, _ = h.Store.CreateNotification(ctx, store.CreateNotificationParams{
		UserID:    backup.OwnerUserID,
		Type:      "error",
		Category:  "backup",
		Title:     "Backup gagal",
		Message:   message,
		ActionURL: siteBackupActionURL(backup.SiteSubdomain),
	})
}

func siteBackupDue(frequency string, lastSuccessfulBackupAt *time.Time, now time.Time) bool {
	if lastSuccessfulBackupAt == nil {
		return true
	}
	return !lastSuccessfulBackupAt.Add(siteBackupFrequencyWindow(frequency)).After(now)
}

func siteBackupFrequencyWindow(frequency string) time.Duration {
	switch strings.ToLower(strings.TrimSpace(frequency)) {
	case store.SiteBackupFrequencyWeekly:
		return 7 * 24 * time.Hour
	case store.SiteBackupFrequencyMonthly:
		return 30 * 24 * time.Hour
	default:
		return 24 * time.Hour
	}
}

func humanizeSiteBackupTrigger(trigger string) string {
	switch strings.ToLower(strings.TrimSpace(trigger)) {
	case "scheduled":
		return "Otomatis"
	default:
		return "Manual"
	}
}

func siteBackupActionURL(subdomain string) string {
	return fmt.Sprintf("/situs/%s?tab=backup", strings.TrimSpace(subdomain))
}

func fileDigest(path string) (int64, string, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, "", fmt.Errorf("open file digest: %w", err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return 0, "", fmt.Errorf("stat file digest: %w", err)
	}

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return 0, "", fmt.Errorf("hash file digest: %w", err)
	}

	return info.Size(), hex.EncodeToString(hasher.Sum(nil)), nil
}
