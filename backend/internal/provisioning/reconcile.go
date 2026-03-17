package provisioning

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/hibiken/asynq"
)

const TaskTypeReconcileOrphanedJobs = "reconcile:orphaned-jobs"

// NewReconcileOrphanedJobsTask creates a periodic task that finds provisioning
// jobs stuck in "pending" status (i.e., the DB commit succeeded but the Asynq
// enqueue failed or the API crashed) and re-enqueues them.
func NewReconcileOrphanedJobsTask() *asynq.Task {
	return asynq.NewTask(TaskTypeReconcileOrphanedJobs, nil)
}

// HandleReconcileOrphanedJobsTask scans for provisioning jobs that have been
// in "pending" status for longer than a threshold and re-enqueues them into
// Asynq. This implements the outbox pattern: the database is the source of
// truth, and the worker periodically reconciles any missed enqueues.
func (h Handler) HandleReconcileOrphanedJobsTask(ctx context.Context, _ *asynq.Task) error {
	orphans, err := h.Store.ListOrphanedProvisioningJobs(ctx, 2*time.Minute)
	if err != nil {
		return fmt.Errorf("list orphaned provisioning jobs: %w", err)
	}

	if len(orphans) == 0 {
		return nil
	}

	log.Printf("reconcile: found %d orphaned provisioning jobs", len(orphans))

	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     h.RedisAddr,
		Password: h.RedisPassword,
	})
	defer asynqClient.Close()

	for _, job := range orphans {
		task, err := NewProvisionSiteTask(job.ID)
		if err != nil {
			log.Printf("reconcile: failed to create task for job=%s: %v", job.ID, err)
			continue
		}

		taskID := "provision-site-" + job.ID.String()
		_, err = asynqClient.Enqueue(
			task,
			asynq.Queue("default"),
			asynq.MaxRetry(5),
			asynq.Timeout(20*time.Minute),
			asynq.TaskID(taskID),
		)
		if err != nil {
			if strings.Contains(err.Error(), "already exists") {
				log.Printf("reconcile: task already enqueued job=%s", job.ID)
				continue
			}
			log.Printf("reconcile: failed to enqueue job=%s: %v", job.ID, err)
			continue
		}

		log.Printf("reconcile: re-enqueued orphaned job=%s site_id=%s", job.ID, job.SiteID)
	}

	return nil
}
