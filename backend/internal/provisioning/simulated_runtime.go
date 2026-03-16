package provisioning

import (
	"context"
	"time"

	"moodlecloud/backend/internal/config"
	"moodlecloud/backend/internal/store"
)

type SimulatedRuntime struct {
	Config config.Config
}

func (r SimulatedRuntime) Provision(_ context.Context, site store.Site) (store.SiteRuntimeMetadata, error) {
	time.Sleep(1200 * time.Millisecond)
	metadata := BuildRuntimeMetadata(r.Config, site)
	metadata.HealthStatus = "unknown"
	return metadata, nil
}

func (SimulatedRuntime) CreateDatabase(_ context.Context, _ store.Site, _ store.SiteRuntimeMetadata) error {
	time.Sleep(1400 * time.Millisecond)
	return nil
}

func (SimulatedRuntime) Install(_ context.Context, _ store.Site, _ store.SiteRuntimeMetadata) error {
	time.Sleep(1600 * time.Millisecond)
	return nil
}

func (SimulatedRuntime) ValidateRoute(_ context.Context, _ store.Site, _ store.SiteRuntimeMetadata) error {
	time.Sleep(1200 * time.Millisecond)
	return nil
}

func (SimulatedRuntime) Finalize(_ context.Context, _ store.Site, _ store.SiteRuntimeMetadata) error {
	time.Sleep(1000 * time.Millisecond)
	return nil
}

func (SimulatedRuntime) Cleanup(_ context.Context, _ store.Site, _ *store.SiteRuntimeMetadata, _ string) error {
	return nil
}

func (SimulatedRuntime) GetRuntimeStatus(_ context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error) {
	return BuildMinimalRuntimeStatus(site, job, metadata), nil
}

func (SimulatedRuntime) StartSite(_ context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error) {
	return BuildMinimalRuntimeStatus(site, job, metadata), ErrRuntimeControlUnsupported
}

func (SimulatedRuntime) RestartSite(_ context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error) {
	return BuildMinimalRuntimeStatus(site, job, metadata), ErrRuntimeControlUnsupported
}

func (SimulatedRuntime) StopSite(_ context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error) {
	return BuildMinimalRuntimeStatus(site, job, metadata), ErrRuntimeControlUnsupported
}
