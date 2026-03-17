package provisioning

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

func TestNewProvisionSiteTask(t *testing.T) {
	jobID := uuid.New()
	task, err := NewProvisionSiteTask(jobID)
	if err != nil {
		t.Fatalf("NewProvisionSiteTask returned error: %v", err)
	}

	if task.Type() != TaskTypeProvisionSite {
		t.Fatalf("task.Type() = %q, want %q", task.Type(), TaskTypeProvisionSite)
	}

	var payload TaskPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}

	if payload.JobID != jobID.String() {
		t.Fatalf("payload.JobID = %q, want %q", payload.JobID, jobID.String())
	}
}

func TestNewMeterSiteUsageSweepTask(t *testing.T) {
	task := NewMeterSiteUsageSweepTask()
	if task.Type() != TaskTypeMeterSiteUsageSweep {
		t.Fatalf("task.Type() = %q, want %q", task.Type(), TaskTypeMeterSiteUsageSweep)
	}
	if len(task.Payload()) != 0 {
		t.Fatalf("expected empty payload, got %q", string(task.Payload()))
	}
}
