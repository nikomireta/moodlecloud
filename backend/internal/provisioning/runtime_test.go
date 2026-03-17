package provisioning

import (
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/google/uuid"

	"moodlecloud/backend/internal/config"
	"moodlecloud/backend/internal/store"
)

func TestBuildSiteURLs(t *testing.T) {
	cfg := config.Config{
		SiteURLScheme:  "http",
		SiteBaseDomain: "lvh.me",
	}

	siteURL, adminURL := BuildSiteURLs(cfg, "demo-sekolah")

	if siteURL != "http://demo-sekolah.lvh.me" {
		t.Fatalf("siteURL = %q, want %q", siteURL, "http://demo-sekolah.lvh.me")
	}
	if adminURL != "http://demo-sekolah.lvh.me/admin" {
		t.Fatalf("adminURL = %q, want %q", adminURL, "http://demo-sekolah.lvh.me/admin")
	}
}

func TestBuildCustomDomainURLs(t *testing.T) {
	cfg := config.Config{SiteURLScheme: "https"}

	siteURL, adminURL := BuildCustomDomainURLs(cfg, "lms.sekolah.sch.id")

	if siteURL != "https://lms.sekolah.sch.id" {
		t.Fatalf("siteURL = %q, want %q", siteURL, "https://lms.sekolah.sch.id")
	}
	if adminURL != "https://lms.sekolah.sch.id/admin" {
		t.Fatalf("adminURL = %q, want %q", adminURL, "https://lms.sekolah.sch.id/admin")
	}
}

func TestBuildRuntimeMetadata(t *testing.T) {
	cfg := config.Config{
		MoodleImageRepository: "local/moodle-app",
		MoodleImageTag:        "5.1-local",
	}
	siteID := uuid.MustParse("11111111-2222-3333-4444-555555555555")
	site := store.Site{
		ID:        siteID,
		Subdomain: "SMKN-1.Jakarta",
	}

	metadata := BuildRuntimeMetadata(cfg, site)

	if metadata.ImageRepository != "local/moodle-app" {
		t.Fatalf("ImageRepository = %q", metadata.ImageRepository)
	}
	if metadata.ImageTag != "5.1-local" {
		t.Fatalf("ImageTag = %q", metadata.ImageTag)
	}
	if !strings.HasPrefix(metadata.WebContainerName, "mc-web-smkn-1jakarta-11111111") {
		t.Fatalf("WebContainerName = %q", metadata.WebContainerName)
	}
	if !strings.HasPrefix(metadata.CronContainerName, "mc-cron-smkn-1jakarta-11111111") {
		t.Fatalf("CronContainerName = %q", metadata.CronContainerName)
	}
	if !strings.HasPrefix(metadata.VolumeName, "mc-data-smkn-1jakarta-11111111") {
		t.Fatalf("VolumeName = %q", metadata.VolumeName)
	}
	if metadata.DatabaseName != "mc_smkn_1jakarta_11111111" {
		t.Fatalf("DatabaseName = %q", metadata.DatabaseName)
	}
	if metadata.DatabaseUser != "mc_u_smkn_1jakarta_11111111" {
		t.Fatalf("DatabaseUser = %q", metadata.DatabaseUser)
	}
}

func TestDerivedPasswordsAreStableAndDistinct(t *testing.T) {
	secret := "test-secret"
	siteID := "11111111-2222-3333-4444-555555555555"

	adminPassword := InitialAdminPassword(secret, siteID)
	databasePassword := DatabasePassword(secret, siteID)

	if adminPassword == databasePassword {
		t.Fatal("expected derived passwords for different scopes to be different")
	}
	if adminPassword != InitialAdminPassword(secret, siteID) {
		t.Fatal("expected initial admin password derivation to be stable")
	}
	if databasePassword != DatabasePassword(secret, siteID) {
		t.Fatal("expected database password derivation to be stable")
	}
	if !strings.HasPrefix(adminPassword, "Mc!") {
		t.Fatalf("admin password prefix = %q", adminPassword)
	}
	if !strings.HasPrefix(databasePassword, "Db!") {
		t.Fatalf("database password prefix = %q", databasePassword)
	}
}

func TestBuildSiteDatabaseURLUsesAdminConnectionHost(t *testing.T) {
	metadata := store.SiteRuntimeMetadata{
		DatabaseName: "mc_demo_11111111",
		DatabaseUser: "mc_u_demo_11111111",
	}

	databaseURL, err := buildSiteDatabaseURL(
		"postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable",
		metadata,
		"Db!secret",
	)
	if err != nil {
		t.Fatalf("buildSiteDatabaseURL returned error: %v", err)
	}

	want := "postgres://mc_u_demo_11111111:Db%21secret@localhost:5432/mc_demo_11111111?sslmode=disable"
	if databaseURL != want {
		t.Fatalf("databaseURL = %q, want %q", databaseURL, want)
	}
}

func TestRouteProbeTargetUsesLoopbackAndHostHeader(t *testing.T) {
	targetURL, hostHeader, err := routeProbeTarget("http://demo.lvh.me/admin?tab=1")
	if err != nil {
		t.Fatalf("routeProbeTarget returned error: %v", err)
	}

	if targetURL != "http://127.0.0.1/admin?tab=1" {
		t.Fatalf("targetURL = %q, want %q", targetURL, "http://127.0.0.1/admin?tab=1")
	}
	if hostHeader != "demo.lvh.me" {
		t.Fatalf("hostHeader = %q, want %q", hostHeader, "demo.lvh.me")
	}
}

func TestCustomDomainHelpers(t *testing.T) {
	cfg := config.Config{
		CustomDomainEnabled: true,
		TraefikACMEResolver: "letsencrypt",
	}
	if !CustomDomainSupported(cfg) {
		t.Fatal("expected custom domain to be supported when feature and resolver are configured")
	}
	if got := CustomDomainTXTName("lms.sekolah.sch.id"); got != "_moodlecloud-verify.lms.sekolah.sch.id" {
		t.Fatalf("CustomDomainTXTName() = %q", got)
	}
}

func TestTraefikRouteReadyReturnsReadyWhenRouterAndServiceAreUp(t *testing.T) {
	rawData := traefikRawData{
		Routers: map[string]traefikRawRouter{
			"mc-demo@docker": {
				Status:  "enabled",
				Service: "mc-demo",
			},
		},
		Services: map[string]traefikRawService{
			"mc-demo@docker": {
				Status:       "enabled",
				ServerStatus: map[string]string{"http://172.28.0.7:80": "UP"},
				LoadBalancer: struct {
					Servers []traefikRawServer `json:"servers"`
				}{
					Servers: []traefikRawServer{{URL: "http://172.28.0.7:80"}},
				},
			},
		},
	}

	ready, observation := traefikRouteReady(rawData, "mc-demo@docker")
	if !ready {
		t.Fatalf("ready = false, observation = %q", observation)
	}
	if observation != "ready" {
		t.Fatalf("observation = %q, want %q", observation, "ready")
	}
}

func TestTraefikRouteReadyReturnsMissingRouter(t *testing.T) {
	ready, observation := traefikRouteReady(traefikRawData{}, "mc-missing@docker")
	if ready {
		t.Fatal("ready = true, want false")
	}
	if observation != "router_missing" {
		t.Fatalf("observation = %q, want %q", observation, "router_missing")
	}
}

func TestShouldPreserveRuntimeArtifacts(t *testing.T) {
	if !shouldPreserveRuntimeArtifacts("ssl") {
		t.Fatal("expected ssl failures to preserve runtime artifacts")
	}
	if !shouldPreserveRuntimeArtifacts("finalize") {
		t.Fatal("expected finalize failures to preserve runtime artifacts")
	}
	if shouldPreserveRuntimeArtifacts("install") {
		t.Fatal("expected install failures to clean up runtime artifacts")
	}
}

func TestCronContainerHealthcheck(t *testing.T) {
	healthcheck := cronContainerHealthcheck()

	if healthcheck == nil {
		t.Fatal("healthcheck = nil")
	}
	if got, want := healthcheck.Test[0], "CMD-SHELL"; got != want {
		t.Fatalf("healthcheck.Test[0] = %q, want %q", got, want)
	}
	if !strings.Contains(healthcheck.Test[1], "/tmp/moodle-cron.last-run") {
		t.Fatalf("healthcheck.Test[1] = %q, want cron heartbeat path", healthcheck.Test[1])
	}
	if healthcheck.StartPeriod != 120*time.Second {
		t.Fatalf("healthcheck.StartPeriod = %s, want %s", healthcheck.StartPeriod, 120*time.Second)
	}
}

func TestBuildHostRule(t *testing.T) {
	got := buildHostRule([]string{"demo.lvh.me", "lms.sekolah.sch.id"})
	want := "Host(`demo.lvh.me`,`lms.sekolah.sch.id`)"
	if got != want {
		t.Fatalf("buildHostRule() = %q, want %q", got, want)
	}
}

func TestBuildMinimalRuntimeStatus(t *testing.T) {
	site := store.Site{Status: "active"}
	job := store.ProvisioningJob{RuntimeMode: "simulated"}
	metadata := &store.SiteRuntimeMetadata{HealthStatus: "healthy"}

	status := BuildMinimalRuntimeStatus(site, job, metadata)

	if status.OverallStatus != "running" {
		t.Fatalf("OverallStatus = %q, want %q", status.OverallStatus, "running")
	}
	if status.Controllable {
		t.Fatal("expected minimal runtime status to be uncontrollable")
	}
}

func TestFormatDatabaseLabel(t *testing.T) {
	if got := formatDatabaseLabel("17.4 (Debian 17.4-1)"); got != "PostgreSQL 17.4" {
		t.Fatalf("formatDatabaseLabel() = %q, want %q", got, "PostgreSQL 17.4")
	}
	if got := formatDatabaseLabel(""); got != "PostgreSQL" {
		t.Fatalf("formatDatabaseLabel() = %q, want %q", got, "PostgreSQL")
	}
}

func TestDeriveOverallRuntimeStatus(t *testing.T) {
	runningServices := []SiteRuntimeService{
		{Name: "web", State: "running", HealthStatus: "healthy"},
		{Name: "cron", State: "running", HealthStatus: "healthy"},
	}
	if got := deriveOverallRuntimeStatus(store.Site{Status: "active"}, runningServices, true); got != "running" {
		t.Fatalf("deriveOverallRuntimeStatus() = %q, want %q", got, "running")
	}

	degradedServices := []SiteRuntimeService{
		{Name: "web", State: "running", HealthStatus: "unhealthy"},
		{Name: "cron", State: "running", HealthStatus: "healthy"},
	}
	if got := deriveOverallRuntimeStatus(store.Site{Status: "active"}, degradedServices, true); got != "degraded" {
		t.Fatalf("deriveOverallRuntimeStatus() = %q, want %q", got, "degraded")
	}

	stoppedServices := []SiteRuntimeService{
		{Name: "web", State: "exited", HealthStatus: "unknown"},
		{Name: "cron", State: "exited", HealthStatus: "unknown"},
	}
	if got := deriveOverallRuntimeStatus(store.Site{Status: "active"}, stoppedServices, false); got != "stopped" {
		t.Fatalf("deriveOverallRuntimeStatus() = %q, want %q", got, "stopped")
	}
}

func TestRuntimeActionTargets(t *testing.T) {
	metadata := store.SiteRuntimeMetadata{
		WebContainerName:  "web-demo",
		CronContainerName: "cron-demo",
	}

	startTargets := runtimeActionTargets(metadata, runtimeActionStart)
	if len(startTargets) != 2 || startTargets[0].Name != "web" || startTargets[1].Name != "cron" {
		t.Fatalf("start target order = %#v", startTargets)
	}

	stopTargets := runtimeActionTargets(metadata, runtimeActionStop)
	if len(stopTargets) != 2 || stopTargets[0].Name != "cron" || stopTargets[1].Name != "web" {
		t.Fatalf("stop target order = %#v", stopTargets)
	}
}

func TestContainerResourcesForService(t *testing.T) {
	runtime := DockerLocalRuntime{
		cfg: config.Config{
			DockerWebPidsLimit:  256,
			DockerCronPidsLimit: 128,
		},
	}
	site := store.Site{
		WebCPUMillicores:  1000,
		WebMemoryMiB:      1536,
		CronCPUMillicores: 250,
		CronMemoryMiB:     512,
	}

	webResources := runtime.containerResourcesForService(site, "web")
	assertContainerResources(t, webResources, 1536*1024*1024, 1_000_000_000, 256)

	cronResources := runtime.containerResourcesForService(site, "cron")
	assertContainerResources(t, cronResources, 512*1024*1024, 250_000_000, 128)
}

func assertContainerResources(t *testing.T, resources container.Resources, wantMemory int64, wantNanoCPUs int64, wantPids int64) {
	t.Helper()
	if resources.Memory != wantMemory {
		t.Fatalf("resources.Memory = %d, want %d", resources.Memory, wantMemory)
	}
	if resources.NanoCPUs != wantNanoCPUs {
		t.Fatalf("resources.NanoCPUs = %d, want %d", resources.NanoCPUs, wantNanoCPUs)
	}
	if resources.PidsLimit == nil || *resources.PidsLimit != wantPids {
		t.Fatalf("resources.PidsLimit = %#v, want %d", resources.PidsLimit, wantPids)
	}
}
