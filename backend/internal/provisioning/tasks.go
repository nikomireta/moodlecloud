package provisioning

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

const (
	TaskTypeProvisionSite        = "provision:site"
	TaskTypeMeterSiteUsageSweep  = "meter:site-usage-sweep"
	TaskTypeBackupSite           = "backup:site"
	TaskTypeBackupScheduleSweep  = "backup:schedule-sweep"
	TaskTypeBackupRetentionSweep = "backup:retention-sweep"
)

type TaskPayload struct {
	JobID string `json:"job_id"`
}

type SiteBackupTaskPayload struct {
	BackupID string `json:"backup_id"`
}

func NewProvisionSiteTask(jobID uuid.UUID) (*asynq.Task, error) {
	payload, err := json.Marshal(TaskPayload{JobID: jobID.String()})
	if err != nil {
		return nil, fmt.Errorf("marshal provision task payload: %w", err)
	}
	return asynq.NewTask(TaskTypeProvisionSite, payload), nil
}

func NewMeterSiteUsageSweepTask() *asynq.Task {
	return asynq.NewTask(TaskTypeMeterSiteUsageSweep, nil)
}

func NewSiteBackupTask(backupID uuid.UUID) (*asynq.Task, error) {
	payload, err := json.Marshal(SiteBackupTaskPayload{BackupID: backupID.String()})
	if err != nil {
		return nil, fmt.Errorf("marshal site backup task payload: %w", err)
	}
	return asynq.NewTask(TaskTypeBackupSite, payload), nil
}

func NewBackupScheduleSweepTask() *asynq.Task {
	return asynq.NewTask(TaskTypeBackupScheduleSweep, nil)
}

func NewBackupRetentionSweepTask() *asynq.Task {
	return asynq.NewTask(TaskTypeBackupRetentionSweep, nil)
}
