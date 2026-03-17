package provisioning

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

const (
	TaskTypeProvisionSite       = "provision:site"
	TaskTypeMeterSiteUsageSweep = "meter:site-usage-sweep"
)

type TaskPayload struct {
	JobID string `json:"job_id"`
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
