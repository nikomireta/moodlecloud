package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	networktypes "github.com/docker/docker/api/types/network"
	volumetypes "github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/docker/docker/errdefs"
	"github.com/jackc/pgx/v5/pgxpool"

	"moodlecloud/backend/internal/config"
	"moodlecloud/backend/internal/store"
)

type DockerLocalRuntime struct {
	cfg        config.Config
	docker     *client.Client
	dbAdmin    *pgxpool.Pool
	httpClient *http.Client
}

type runtimeAction string

const (
	runtimeActionStart   runtimeAction = "start"
	runtimeActionRestart runtimeAction = "restart"
	runtimeActionStop    runtimeAction = "stop"
)

type runtimeServiceTarget struct {
	Name          string
	ContainerName string
}

func NewDockerLocalRuntime(cfg config.Config) (*DockerLocalRuntime, error) {
	dockerClient, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("create docker client: %w", err)
	}

	dbAdminPool, err := pgxpool.New(context.Background(), cfg.SiteDBAdminURL)
	if err != nil {
		return nil, fmt.Errorf("open site db admin pool: %w", err)
	}

	return &DockerLocalRuntime{
		cfg:     cfg,
		docker:  dockerClient,
		dbAdmin: dbAdminPool,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}, nil
}

func (r *DockerLocalRuntime) Provision(ctx context.Context, site store.Site) (store.SiteRuntimeMetadata, error) {
	metadata := BuildRuntimeMetadata(r.cfg, site)
	if err := r.ensureImage(ctx, metadata); err != nil {
		return store.SiteRuntimeMetadata{}, err
	}
	if err := r.ensureProxyNetwork(ctx); err != nil {
		return store.SiteRuntimeMetadata{}, err
	}
	if err := r.ensureVolume(ctx, metadata); err != nil {
		return store.SiteRuntimeMetadata{}, err
	}
	return metadata, nil
}

func (r *DockerLocalRuntime) CreateDatabase(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error {
	password := DatabasePassword(r.cfg.SiteRuntimeSecret, site.ID.String())
	if err := r.ensureDatabaseUser(ctx, metadata.DatabaseUser, password); err != nil {
		return err
	}
	if err := r.ensureDatabase(ctx, metadata.DatabaseName, metadata.DatabaseUser); err != nil {
		return err
	}
	return nil
}

func (r *DockerLocalRuntime) Install(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error {
	if err := r.ensureWebContainer(ctx, site, metadata); err != nil {
		return err
	}
	if err := r.waitForConfigFile(ctx, metadata.WebContainerName); err != nil {
		return err
	}
	installed, err := r.siteInstalled(ctx, site, metadata)
	if err != nil {
		return err
	}
	if !installed {
		adminPassword := InitialAdminPassword(r.cfg.SiteRuntimeSecret, site.ID.String())
		execID, err := r.startExecInContainer(ctx, metadata.WebContainerName, "www-data", []string{
			"php",
			"/var/www/html/admin/cli/install_database.php",
			"--agree-license",
			fmt.Sprintf("--fullname=%s", site.Name),
			fmt.Sprintf("--shortname=%s", site.Name),
			"--adminuser=admin",
			fmt.Sprintf("--adminpass=%s", adminPassword),
			fmt.Sprintf("--adminemail=%s", site.AdminEmail),
			fmt.Sprintf("--supportemail=%s", site.AdminEmail),
		})
		if err != nil {
			return err
		}
		if err := r.waitForInstallerReady(ctx, site, metadata, execID); err != nil {
			return err
		}
	}
	return r.ensureCronContainer(ctx, site, metadata)
}

func (r *DockerLocalRuntime) ValidateRoute(ctx context.Context, site store.Site, _ store.SiteRuntimeMetadata) error {
	if err := r.waitForTraefikRoute(ctx, site); err != nil {
		return err
	}

	targetURL, hostHeader, err := routeProbeTarget(site.SiteURL)
	if err != nil {
		return fmt.Errorf("build route validation target: %w", err)
	}

	deadline := time.Now().Add(60 * time.Second)
	lastObservation := ""
	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
		if err != nil {
			return fmt.Errorf("build route validation request: %w", err)
		}
		if hostHeader != "" {
			req.Host = hostHeader
		}
		resp, err := r.httpClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			observation := fmt.Sprintf("provisioning: route probe site=%s host=%s target=%s status=%d", site.Subdomain, hostHeader, targetURL, resp.StatusCode)
			logIfChanged(&lastObservation, observation)
			if resp.StatusCode >= 200 && resp.StatusCode < 400 {
				log.Printf("provisioning: route ready site=%s host=%s", site.Subdomain, hostHeader)
				return nil
			}
		} else {
			logIfChanged(&lastObservation, fmt.Sprintf("provisioning: route probe site=%s host=%s target=%s error=%v", site.Subdomain, hostHeader, targetURL, err))
		}
		if time.Now().After(deadline) {
			if err != nil {
				return fmt.Errorf("validate site route: %w", err)
			}
			return fmt.Errorf("validate site route: unexpected status %d", resp.StatusCode)
		}
		time.Sleep(2 * time.Second)
	}
}

func (r *DockerLocalRuntime) Finalize(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error {
	return r.ValidateRoute(ctx, site, metadata)
}

func (r *DockerLocalRuntime) Cleanup(ctx context.Context, site store.Site, metadata *store.SiteRuntimeMetadata, failedStep string) error {
	if metadata == nil {
		return nil
	}
	if shouldPreserveRuntimeArtifacts(failedStep) {
		log.Printf("provisioning: preserving runtime artifacts for site=%s step=%s", site.Subdomain, failedStep)
		return nil
	}
	var errs []string
	if err := r.removeContainerIfExists(ctx, metadata.CronContainerName); err != nil {
		errs = append(errs, err.Error())
	}
	if err := r.removeContainerIfExists(ctx, metadata.WebContainerName); err != nil {
		errs = append(errs, err.Error())
	}
	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

func (r *DockerLocalRuntime) GetRuntimeStatus(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error) {
	if metadata == nil {
		return BuildMinimalRuntimeStatus(site, job, metadata), nil
	}
	if strings.TrimSpace(job.RuntimeMode) != "docker_local" {
		return BuildMinimalRuntimeStatus(site, job, metadata), nil
	}

	services, lastError, err := r.inspectRuntimeServices(ctx, *metadata)
	if err != nil {
		return SiteRuntimeStatus{}, err
	}

	routeReady := false
	routeObservation := ""
	if shouldCheckRuntimeRoute(site, services) {
		routeReady, routeObservation = r.probeSiteRoute(site.SiteURL)
		if !routeReady && lastError == "" {
			lastError = humanizeRouteObservation(routeObservation)
		}
	}

	overallStatus := deriveOverallRuntimeStatus(site, services, routeReady)
	if overallStatus == "running" {
		lastError = ""
	}
	if lastError == "" {
		lastError = strings.TrimSpace(metadata.LastHealthError)
	}

	return SiteRuntimeStatus{
		Site:          site,
		RuntimeMode:   job.RuntimeMode,
		Controllable:  site.Status == "active",
		OverallStatus: overallStatus,
		LastError:     lastError,
		Services:      services,
		Runtime:       metadata,
	}, nil
}

func (r *DockerLocalRuntime) StartSite(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error) {
	return r.changeSiteRuntime(ctx, site, job, metadata, runtimeActionStart)
}

func (r *DockerLocalRuntime) RestartSite(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error) {
	return r.changeSiteRuntime(ctx, site, job, metadata, runtimeActionRestart)
}

func (r *DockerLocalRuntime) StopSite(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata) (SiteRuntimeStatus, error) {
	return r.changeSiteRuntime(ctx, site, job, metadata, runtimeActionStop)
}

func (r *DockerLocalRuntime) changeSiteRuntime(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata *store.SiteRuntimeMetadata, action runtimeAction) (SiteRuntimeStatus, error) {
	if strings.TrimSpace(job.RuntimeMode) != "docker_local" {
		return BuildMinimalRuntimeStatus(site, job, metadata), ErrRuntimeControlUnsupported
	}
	if metadata == nil {
		return BuildMinimalRuntimeStatus(site, job, metadata), ErrRuntimeMetadataMissing
	}
	if site.Status != "active" {
		return BuildMinimalRuntimeStatus(site, job, metadata), ErrRuntimeNotControllable
	}

	targets := runtimeActionTargets(*metadata, action)
	for _, target := range targets {
		switch action {
		case runtimeActionStart:
			if err := r.startContainerIfNeeded(ctx, target.ContainerName); err != nil {
				return SiteRuntimeStatus{}, err
			}
		case runtimeActionRestart:
			if err := r.restartContainerIfNeeded(ctx, target.ContainerName); err != nil {
				return SiteRuntimeStatus{}, err
			}
		case runtimeActionStop:
			if err := r.stopContainerIfNeeded(ctx, target.ContainerName); err != nil {
				return SiteRuntimeStatus{}, err
			}
		default:
			return SiteRuntimeStatus{}, fmt.Errorf("unsupported runtime action: %s", action)
		}
	}

	if action == runtimeActionStart || action == runtimeActionRestart {
		if err := r.ValidateRoute(ctx, site, *metadata); err != nil {
			return SiteRuntimeStatus{}, err
		}
	}

	return r.GetRuntimeStatus(ctx, site, job, metadata)
}

func (r *DockerLocalRuntime) ensureImage(ctx context.Context, metadata store.SiteRuntimeMetadata) error {
	if _, _, err := r.docker.ImageInspectWithRaw(ctx, imageRef(metadata)); err != nil {
		if errdefs.IsNotFound(err) {
			return fmt.Errorf("moodle image %s tidak ditemukan secara lokal", imageRef(metadata))
		}
		return fmt.Errorf("inspect docker image: %w", err)
	}
	return nil
}

func (r *DockerLocalRuntime) ensureProxyNetwork(ctx context.Context) error {
	if _, err := r.docker.NetworkInspect(ctx, r.cfg.DockerProxyNetwork, networktypes.InspectOptions{}); err != nil {
		if errdefs.IsNotFound(err) {
			return fmt.Errorf("docker network %s tidak ditemukan", r.cfg.DockerProxyNetwork)
		}
		return fmt.Errorf("inspect docker network: %w", err)
	}
	return nil
}

func (r *DockerLocalRuntime) ensureVolume(ctx context.Context, metadata store.SiteRuntimeMetadata) error {
	if _, err := r.docker.VolumeCreate(ctx, volumetypes.CreateOptions{
		Name: metadata.VolumeName,
		Labels: map[string]string{
			"moodlecloud.managed": "true",
			"moodlecloud.site-id": metadata.SiteID.String(),
		},
	}); err != nil {
		return fmt.Errorf("create docker volume: %w", err)
	}
	return nil
}

func (r *DockerLocalRuntime) ensureDatabaseUser(ctx context.Context, username, password string) error {
	createSQL := fmt.Sprintf(`
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %s) THEN
		CREATE ROLE %s LOGIN PASSWORD %s;
	END IF;
END
$$;
`, quoteLiteral(username), quoteIdentifier(username), quoteLiteral(password))
	if _, err := r.dbAdmin.Exec(ctx, createSQL); err != nil {
		return fmt.Errorf("create database user: %w", err)
	}
	if _, err := r.dbAdmin.Exec(ctx, fmt.Sprintf("ALTER ROLE %s WITH LOGIN PASSWORD %s", quoteIdentifier(username), quoteLiteral(password))); err != nil {
		return fmt.Errorf("alter database user password: %w", err)
	}
	return nil
}

func (r *DockerLocalRuntime) ensureDatabase(ctx context.Context, databaseName, owner string) error {
	var exists bool
	if err := r.dbAdmin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, databaseName).Scan(&exists); err != nil {
		return fmt.Errorf("check database exists: %w", err)
	}
	if !exists {
		if _, err := r.dbAdmin.Exec(ctx, fmt.Sprintf("CREATE DATABASE %s OWNER %s", quoteIdentifier(databaseName), quoteIdentifier(owner))); err != nil {
			return fmt.Errorf("create database: %w", err)
		}
	}
	if _, err := r.dbAdmin.Exec(ctx, fmt.Sprintf("ALTER DATABASE %s OWNER TO %s", quoteIdentifier(databaseName), quoteIdentifier(owner))); err != nil {
		return fmt.Errorf("alter database owner: %w", err)
	}
	return nil
}

func (r *DockerLocalRuntime) ensureWebContainer(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error {
	labels := map[string]string{
		"moodlecloud.managed":    "true",
		"moodlecloud.site-id":    site.ID.String(),
		"traefik.enable":         "true",
		"traefik.docker.network": r.cfg.DockerProxyNetwork,
		fmt.Sprintf("traefik.http.routers.%s.rule", routerName(site)):                      fmt.Sprintf("Host(`%s`)", siteHost(site.SiteURL)),
		fmt.Sprintf("traefik.http.routers.%s.entrypoints", routerName(site)):               "web",
		fmt.Sprintf("traefik.http.routers.%s.service", routerName(site)):                   routerName(site),
		fmt.Sprintf("traefik.http.services.%s.loadbalancer.server.port", routerName(site)): "80",
	}
	env := r.runtimeEnv(site, metadata)
	return r.ensureContainer(ctx, metadata.WebContainerName, imageRef(metadata), env, labels, nil, nil, metadata, false)
}

func (r *DockerLocalRuntime) ensureCronContainer(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) error {
	labels := map[string]string{
		"moodlecloud.managed": "true",
		"moodlecloud.site-id": site.ID.String(),
	}
	env := r.runtimeEnv(site, metadata)
	cmd := []string{"/usr/local/bin/cron.sh"}
	return r.ensureContainer(ctx, metadata.CronContainerName, imageRef(metadata), env, labels, cmd, cronContainerHealthcheck(), metadata, false)
}

func (r *DockerLocalRuntime) ensureContainer(ctx context.Context, name, image string, env []string, labels map[string]string, cmd []string, healthcheck *container.HealthConfig, metadata store.SiteRuntimeMetadata, attachTTY bool) error {
	inspect, err := r.docker.ContainerInspect(ctx, name)
	if err == nil {
		if inspect.State != nil && inspect.State.Running {
			return nil
		}
		if err := r.docker.ContainerStart(ctx, inspect.ID, container.StartOptions{}); err != nil {
			return fmt.Errorf("start container %s: %w", name, err)
		}
		return nil
	}
	if !errdefs.IsNotFound(err) {
		return fmt.Errorf("inspect container %s: %w", name, err)
	}

	config := &container.Config{
		Image:       image,
		Env:         env,
		Labels:      labels,
		Cmd:         cmd,
		Healthcheck: healthcheck,
		Tty:         attachTTY,
	}
	hostConfig := &container.HostConfig{
		RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
		Binds:         []string{fmt.Sprintf("%s:/var/www/moodledata", metadata.VolumeName)},
	}
	networkingConfig := &networktypes.NetworkingConfig{
		EndpointsConfig: map[string]*networktypes.EndpointSettings{
			r.cfg.DockerProxyNetwork: {},
		},
	}
	created, err := r.docker.ContainerCreate(ctx, config, hostConfig, networkingConfig, nil, name)
	if err != nil {
		return fmt.Errorf("create container %s: %w", name, err)
	}
	if err := r.docker.ContainerStart(ctx, created.ID, container.StartOptions{}); err != nil {
		return fmt.Errorf("start container %s: %w", name, err)
	}
	return nil
}

func cronContainerHealthcheck() *container.HealthConfig {
	return &container.HealthConfig{
		Test:        []string{"CMD-SHELL", "test -f /tmp/moodle-cron.last-run && find /tmp/moodle-cron.last-run -mmin -3 | grep -q ."},
		Interval:    30 * time.Second,
		Timeout:     5 * time.Second,
		StartPeriod: 120 * time.Second,
		Retries:     3,
	}
}

func (r *DockerLocalRuntime) waitForConfigFile(ctx context.Context, containerName string) error {
	deadline := time.Now().Add(20 * time.Second)
	for {
		err := r.execInContainer(ctx, containerName, "root", []string{"test", "-f", "/var/www/html/config.php"})
		if err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("wait for config.php: %w", err)
		}
		time.Sleep(1 * time.Second)
	}
}

func (r *DockerLocalRuntime) siteInstalled(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata) (bool, error) {
	log.Printf(
		"provisioning: verifying moodle install for site=%s host=%s db=%s",
		site.Subdomain,
		siteDatabaseHost(r.cfg.SiteDBAdminURL),
		metadata.DatabaseName,
	)
	siteDBURL, err := buildSiteDatabaseURL(r.cfg.SiteDBAdminURL, metadata, DatabasePassword(r.cfg.SiteRuntimeSecret, site.ID.String()))
	if err != nil {
		return false, fmt.Errorf("build site database url: %w", err)
	}
	pool, err := pgxpool.New(ctx, siteDBURL)
	if err != nil {
		return false, fmt.Errorf("open site database: %w", err)
	}
	defer pool.Close()

	var installed bool
	if err := pool.QueryRow(ctx, `SELECT to_regclass('public.mdl_config') IS NOT NULL`).Scan(&installed); err != nil {
		return false, fmt.Errorf("check moodle install state: %w", err)
	}
	return installed, nil
}

func (r *DockerLocalRuntime) execInContainer(ctx context.Context, containerName, user string, cmd []string) error {
	execID, err := r.startExecInContainer(ctx, containerName, user, cmd)
	if err != nil {
		return err
	}
	return r.waitForExecExit(ctx, containerName, execID, cmd)
}

func (r *DockerLocalRuntime) startExecInContainer(ctx context.Context, containerName, user string, cmd []string) (string, error) {
	log.Printf("provisioning: exec start container=%s user=%s cmd=%s", containerName, user, strings.Join(cmd, " "))
	execResp, err := r.docker.ContainerExecCreate(ctx, containerName, container.ExecOptions{
		User: user,
		Cmd:  cmd,
	})
	if err != nil {
		return "", fmt.Errorf("create exec in %s: %w", containerName, err)
	}
	if err := r.docker.ContainerExecStart(ctx, execResp.ID, container.ExecStartOptions{}); err != nil {
		return "", fmt.Errorf("start exec in %s: %w", containerName, err)
	}
	return execResp.ID, nil
}

func (r *DockerLocalRuntime) waitForExecExit(ctx context.Context, containerName, execID string, cmd []string) error {
	for {
		inspect, err := r.docker.ContainerExecInspect(ctx, execID)
		if err != nil {
			return fmt.Errorf("inspect exec in %s: %w", containerName, err)
		}
		if !inspect.Running {
			if inspect.ExitCode != 0 {
				return fmt.Errorf("exec in %s failed with exit code %d", containerName, inspect.ExitCode)
			}
			log.Printf("provisioning: exec finished container=%s exit_code=%d cmd=%s", containerName, inspect.ExitCode, strings.Join(cmd, " "))
			return nil
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func (r *DockerLocalRuntime) waitForInstallerReady(ctx context.Context, site store.Site, metadata store.SiteRuntimeMetadata, execID string) error {
	deadline := time.Now().Add(5 * time.Minute)
	lastObservation := ""

	for {
		inspect, err := r.docker.ContainerExecInspect(ctx, execID)
		if err != nil {
			return fmt.Errorf("inspect installer exec in %s: %w", metadata.WebContainerName, err)
		}

		installed, err := r.siteInstalled(ctx, site, metadata)
		if err != nil {
			return err
		}

		if installed {
			routeReady, observation := r.probeSiteRoute(site.SiteURL)
			logIfChanged(&lastObservation, fmt.Sprintf("provisioning: installer readiness site=%s exec_running=%t exit_code=%d state=%s", site.Subdomain, inspect.Running, inspect.ExitCode, observation))
			if routeReady {
				log.Printf("provisioning: installer ready site=%s exec_running=%t exit_code=%d", site.Subdomain, inspect.Running, inspect.ExitCode)
				return nil
			}
			if !inspect.Running {
				if inspect.ExitCode != 0 {
					return fmt.Errorf("exec in %s failed with exit code %d", metadata.WebContainerName, inspect.ExitCode)
				}
				log.Printf("provisioning: installer exited after site install site=%s", site.Subdomain)
				return nil
			}
		} else if !inspect.Running {
			if inspect.ExitCode != 0 {
				return fmt.Errorf("exec in %s failed with exit code %d", metadata.WebContainerName, inspect.ExitCode)
			}
			return fmt.Errorf("installer exited before site install completed for %s", site.Subdomain)
		}

		if time.Now().After(deadline) {
			if installed {
				log.Printf("provisioning: installer deadline reached but site is installed site=%s exec_running=%t", site.Subdomain, inspect.Running)
				return nil
			}
			return fmt.Errorf("installer readiness timeout for %s", site.Subdomain)
		}
		time.Sleep(2 * time.Second)
	}
}

func (r *DockerLocalRuntime) removeContainerIfExists(ctx context.Context, name string) error {
	inspect, err := r.docker.ContainerInspect(ctx, name)
	if err != nil {
		if errdefs.IsNotFound(err) {
			return nil
		}
		return fmt.Errorf("inspect container %s: %w", name, err)
	}
	if inspect.State != nil && inspect.State.Running {
		timeout := 5
		if err := r.docker.ContainerStop(ctx, inspect.ID, container.StopOptions{Timeout: &timeout}); err != nil && !errdefs.IsNotFound(err) {
			return fmt.Errorf("stop container %s: %w", name, err)
		}
	}
	if err := r.docker.ContainerRemove(ctx, inspect.ID, container.RemoveOptions{Force: true}); err != nil && !errdefs.IsNotFound(err) {
		return fmt.Errorf("remove container %s: %w", name, err)
	}
	return nil
}

func (r *DockerLocalRuntime) inspectRuntimeServices(ctx context.Context, metadata store.SiteRuntimeMetadata) ([]SiteRuntimeService, string, error) {
	targets := []runtimeServiceTarget{
		{Name: "web", ContainerName: metadata.WebContainerName},
		{Name: "cron", ContainerName: metadata.CronContainerName},
	}

	services := make([]SiteRuntimeService, 0, len(targets))
	lastError := ""
	for _, target := range targets {
		service, err := r.inspectRuntimeService(ctx, target)
		if err != nil {
			return nil, "", err
		}
		if lastError == "" && strings.TrimSpace(service.StatusText) == "Container tidak ditemukan" {
			lastError = fmt.Sprintf("Container %s tidak ditemukan", target.Name)
		}
		services = append(services, service)
	}
	return services, lastError, nil
}

func (r *DockerLocalRuntime) inspectRuntimeService(ctx context.Context, target runtimeServiceTarget) (SiteRuntimeService, error) {
	inspect, err := r.docker.ContainerInspect(ctx, target.ContainerName)
	if err != nil {
		if errdefs.IsNotFound(err) {
			return SiteRuntimeService{
				Name:          target.Name,
				ContainerName: target.ContainerName,
				State:         "missing",
				HealthStatus:  "unknown",
				StatusText:    "Container tidak ditemukan",
			}, nil
		}
		return SiteRuntimeService{}, fmt.Errorf("inspect container %s: %w", target.ContainerName, err)
	}

	service := SiteRuntimeService{
		Name:          target.Name,
		ContainerName: target.ContainerName,
		State:         "unknown",
		HealthStatus:  "unknown",
		StatusText:    "Status belum diketahui",
	}

	if inspect.State != nil {
		service.State = strings.TrimSpace(inspect.State.Status)
		if service.State == "" {
			service.State = "unknown"
		}
		if inspect.State.Health != nil && strings.TrimSpace(inspect.State.Health.Status) != "" {
			service.HealthStatus = strings.TrimSpace(inspect.State.Health.Status)
		}
		service.StartedAt = parseDockerTimestamp(inspect.State.StartedAt)
		service.FinishedAt = parseDockerTimestamp(inspect.State.FinishedAt)
	}
	service.StatusText = describeRuntimeService(service.State, service.HealthStatus)

	return service, nil
}

func (r *DockerLocalRuntime) startContainerIfNeeded(ctx context.Context, containerName string) error {
	inspect, err := r.docker.ContainerInspect(ctx, containerName)
	if err != nil {
		if errdefs.IsNotFound(err) {
			return fmt.Errorf("container %s tidak ditemukan", containerName)
		}
		return fmt.Errorf("inspect container %s: %w", containerName, err)
	}
	if inspect.State != nil && inspect.State.Running {
		return nil
	}
	if err := r.docker.ContainerStart(ctx, inspect.ID, container.StartOptions{}); err != nil && !errdefs.IsConflict(err) {
		return fmt.Errorf("start container %s: %w", containerName, err)
	}
	return nil
}

func (r *DockerLocalRuntime) stopContainerIfNeeded(ctx context.Context, containerName string) error {
	inspect, err := r.docker.ContainerInspect(ctx, containerName)
	if err != nil {
		if errdefs.IsNotFound(err) {
			return nil
		}
		return fmt.Errorf("inspect container %s: %w", containerName, err)
	}
	if inspect.State == nil || !inspect.State.Running {
		return nil
	}
	timeout := 10
	if err := r.docker.ContainerStop(ctx, inspect.ID, container.StopOptions{Timeout: &timeout}); err != nil && !errdefs.IsNotFound(err) {
		return fmt.Errorf("stop container %s: %w", containerName, err)
	}
	return nil
}

func (r *DockerLocalRuntime) restartContainerIfNeeded(ctx context.Context, containerName string) error {
	inspect, err := r.docker.ContainerInspect(ctx, containerName)
	if err != nil {
		if errdefs.IsNotFound(err) {
			return fmt.Errorf("container %s tidak ditemukan", containerName)
		}
		return fmt.Errorf("inspect container %s: %w", containerName, err)
	}
	if inspect.State == nil || !inspect.State.Running {
		return r.startContainerIfNeeded(ctx, containerName)
	}
	timeout := 10
	if err := r.docker.ContainerRestart(ctx, inspect.ID, container.StopOptions{Timeout: &timeout}); err != nil {
		return fmt.Errorf("restart container %s: %w", containerName, err)
	}
	return nil
}

func (r *DockerLocalRuntime) runtimeEnv(site store.Site, metadata store.SiteRuntimeMetadata) []string {
	dbPassword := DatabasePassword(r.cfg.SiteRuntimeSecret, site.ID.String())
	return []string{
		"MOODLE_DB_TYPE=pgsql",
		"MOODLE_DB_HOST=postgres",
		"MOODLE_DB_PORT=5432",
		fmt.Sprintf("MOODLE_DB_NAME=%s", metadata.DatabaseName),
		fmt.Sprintf("MOODLE_DB_USER=%s", metadata.DatabaseUser),
		fmt.Sprintf("MOODLE_DB_PASSWORD=%s", dbPassword),
		fmt.Sprintf("MOODLE_WWWROOT=%s", site.SiteURL),
		"MOODLE_DATAROOT=/var/www/moodledata",
		"MOODLE_ADMIN_PATH=admin",
	}
}

func imageRef(metadata store.SiteRuntimeMetadata) string {
	if metadata.ImageTag == "" {
		return metadata.ImageRepository
	}
	return metadata.ImageRepository + ":" + metadata.ImageTag
}

func buildSiteDatabaseURL(adminDatabaseURL string, metadata store.SiteRuntimeMetadata, password string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(adminDatabaseURL))
	if err != nil {
		return "", fmt.Errorf("parse admin database url: %w", err)
	}
	if parsed.Scheme == "" {
		parsed.Scheme = "postgres"
	}
	if parsed.Host == "" {
		return "", errors.New("admin database url host is empty")
	}

	query := parsed.Query()
	if query.Get("sslmode") == "" {
		query.Set("sslmode", "disable")
	}

	return fmt.Sprintf(
		"%s://%s:%s@%s/%s?%s",
		parsed.Scheme,
		url.QueryEscape(metadata.DatabaseUser),
		url.QueryEscape(password),
		parsed.Host,
		url.QueryEscape(metadata.DatabaseName),
		query.Encode(),
	), nil
}

func siteDatabaseHost(adminDatabaseURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(adminDatabaseURL))
	if err != nil || parsed.Host == "" {
		return "unknown"
	}
	return parsed.Host
}

func quoteIdentifier(value string) string {
	return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
}

func quoteLiteral(value string) string {
	return `'` + strings.ReplaceAll(value, `'`, `''`) + `'`
}

func routerName(site store.Site) string {
	return fmt.Sprintf("mc-%s", sanitizeResourceSlug(site.Subdomain))
}

func siteHost(siteURL string) string {
	parsed, err := url.Parse(siteURL)
	if err != nil {
		return strings.TrimPrefix(siteURL, "http://")
	}
	return parsed.Host
}

func routeProbeTarget(siteURL string) (string, string, error) {
	parsed, err := url.Parse(strings.TrimSpace(siteURL))
	if err != nil {
		return "", "", fmt.Errorf("parse site url: %w", err)
	}
	if parsed.Scheme == "" {
		parsed.Scheme = "http"
	}
	if parsed.Host == "" {
		return "", "", errors.New("site url host is empty")
	}

	hostHeader := parsed.Host
	if port := parsed.Port(); port != "" {
		parsed.Host = net.JoinHostPort("127.0.0.1", port)
	} else {
		parsed.Host = "127.0.0.1"
	}
	return parsed.String(), hostHeader, nil
}

func (r *DockerLocalRuntime) probeSiteRoute(siteURL string) (bool, string) {
	targetURL, hostHeader, err := routeProbeTarget(siteURL)
	if err != nil {
		return false, fmt.Sprintf("route_probe_invalid_url error=%v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return false, fmt.Sprintf("route_probe_build_error error=%v", err)
	}
	if hostHeader != "" {
		req.Host = hostHeader
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return false, fmt.Sprintf("route_probe_error error=%v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return true, fmt.Sprintf("route_probe_status=%d", resp.StatusCode)
	}
	return false, fmt.Sprintf("route_probe_status=%d", resp.StatusCode)
}

func (r *DockerLocalRuntime) waitForTraefikRoute(ctx context.Context, site store.Site) error {
	deadline := time.Now().Add(60 * time.Second)
	routerKey := routerName(site) + "@docker"
	lastObservation := ""
	var lastErr error

	for {
		rawData, err := r.fetchTraefikRawData(ctx)
		if err != nil {
			lastErr = err
			logIfChanged(&lastObservation, fmt.Sprintf("provisioning: traefik route check site=%s router=%s state=api_error error=%v", site.Subdomain, routerKey, err))
		} else {
			ready, observation := traefikRouteReady(rawData, routerKey)
			logIfChanged(&lastObservation, fmt.Sprintf("provisioning: traefik route check site=%s router=%s state=%s", site.Subdomain, routerKey, observation))
			if ready {
				return nil
			}
			lastErr = nil
		}

		if time.Now().After(deadline) {
			if lastErr != nil {
				return fmt.Errorf("wait for traefik route: %w", lastErr)
			}
			return fmt.Errorf("wait for traefik route: %s", strings.TrimPrefix(lastObservation, fmt.Sprintf("provisioning: traefik route check site=%s router=%s state=", site.Subdomain, routerKey)))
		}
		time.Sleep(2 * time.Second)
	}
}

func (r *DockerLocalRuntime) fetchTraefikRawData(ctx context.Context) (traefikRawData, error) {
	endpoint := strings.TrimRight(strings.TrimSpace(r.cfg.TraefikAPIURL), "/") + "/api/rawdata"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return traefikRawData{}, fmt.Errorf("build traefik rawdata request: %w", err)
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return traefikRawData{}, fmt.Errorf("request traefik rawdata: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return traefikRawData{}, fmt.Errorf("request traefik rawdata: unexpected status %d", resp.StatusCode)
	}

	var rawData traefikRawData
	if err := json.NewDecoder(resp.Body).Decode(&rawData); err != nil {
		return traefikRawData{}, fmt.Errorf("decode traefik rawdata: %w", err)
	}
	return rawData, nil
}

type traefikRawData struct {
	Routers  map[string]traefikRawRouter  `json:"routers"`
	Services map[string]traefikRawService `json:"services"`
}

type traefikRawRouter struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

type traefikRawService struct {
	Status       string            `json:"status"`
	ServerStatus map[string]string `json:"serverStatus"`
	LoadBalancer struct {
		Servers []traefikRawServer `json:"servers"`
	} `json:"loadBalancer"`
}

type traefikRawServer struct {
	URL string `json:"url"`
}

func traefikRouteReady(rawData traefikRawData, routerKey string) (bool, string) {
	router, ok := rawData.Routers[routerKey]
	if !ok {
		return false, "router_missing"
	}
	if router.Status != "" && !strings.EqualFold(router.Status, "enabled") {
		return false, "router_not_enabled"
	}

	service, ok := lookupTraefikService(rawData.Services, routerKey, router.Service)
	if !ok {
		return false, "service_missing"
	}
	if service.Status != "" && !strings.EqualFold(service.Status, "enabled") {
		return false, "service_not_enabled"
	}
	if len(service.LoadBalancer.Servers) == 0 {
		return false, "service_no_servers"
	}
	if len(service.ServerStatus) == 0 {
		return false, "service_status_pending"
	}
	for _, status := range service.ServerStatus {
		if !strings.EqualFold(status, "up") {
			return false, "service_server_not_up"
		}
	}
	return true, "ready"
}

func lookupTraefikService(services map[string]traefikRawService, routerKey, routerService string) (traefikRawService, bool) {
	candidates := []string{
		strings.TrimSpace(routerService),
		strings.TrimSpace(routerService) + "@docker",
		routerKey,
	}
	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		service, ok := services[candidate]
		if ok {
			return service, true
		}
	}
	return traefikRawService{}, false
}

func shouldPreserveRuntimeArtifacts(failedStep string) bool {
	switch strings.TrimSpace(strings.ToLower(failedStep)) {
	case "ssl", "finalize":
		return true
	default:
		return false
	}
}

func logIfChanged(previous *string, current string) {
	if current == "" || current == *previous {
		return
	}
	log.Print(current)
	*previous = current
}

func runtimeActionTargets(metadata store.SiteRuntimeMetadata, action runtimeAction) []runtimeServiceTarget {
	switch action {
	case runtimeActionStop:
		return []runtimeServiceTarget{
			{Name: "cron", ContainerName: metadata.CronContainerName},
			{Name: "web", ContainerName: metadata.WebContainerName},
		}
	default:
		return []runtimeServiceTarget{
			{Name: "web", ContainerName: metadata.WebContainerName},
			{Name: "cron", ContainerName: metadata.CronContainerName},
		}
	}
}

func deriveOverallRuntimeStatus(site store.Site, services []SiteRuntimeService, routeReady bool) string {
	switch strings.TrimSpace(strings.ToLower(site.Status)) {
	case "pending", "provisioning":
		return "provisioning"
	case "failed":
		return "failed"
	}

	web := findRuntimeService(services, "web")
	cron := findRuntimeService(services, "cron")
	if web == nil || cron == nil {
		return "unknown"
	}

	if web.State == "missing" || cron.State == "missing" {
		return "unknown"
	}
	if !isRunningState(web.State) && !isRunningState(cron.State) {
		return "stopped"
	}
	if isRunningState(web.State) && isRunningState(cron.State) {
		if !isHealthyState(web.HealthStatus) || !isHealthyState(cron.HealthStatus) || !routeReady {
			return "degraded"
		}
		return "running"
	}
	return "degraded"
}

func findRuntimeService(services []SiteRuntimeService, name string) *SiteRuntimeService {
	for i := range services {
		if services[i].Name == name {
			return &services[i]
		}
	}
	return nil
}

func shouldCheckRuntimeRoute(site store.Site, services []SiteRuntimeService) bool {
	if strings.TrimSpace(strings.ToLower(site.Status)) != "active" {
		return false
	}
	web := findRuntimeService(services, "web")
	cron := findRuntimeService(services, "cron")
	return web != nil && cron != nil && isRunningState(web.State) && isRunningState(cron.State)
}

func isRunningState(state string) bool {
	return strings.EqualFold(strings.TrimSpace(state), "running")
}

func isHealthyState(status string) bool {
	status = strings.TrimSpace(strings.ToLower(status))
	return status == "" || status == "healthy"
}

func describeRuntimeService(state, healthStatus string) string {
	switch strings.TrimSpace(strings.ToLower(state)) {
	case "running":
		switch strings.TrimSpace(strings.ToLower(healthStatus)) {
		case "", "healthy":
			return "Berjalan"
		case "starting":
			return "Menyiapkan service"
		default:
			return "Berjalan tapi tidak sehat"
		}
	case "exited":
		return "Berhenti"
	case "created":
		return "Siap dijalankan"
	case "restarting":
		return "Memulai ulang"
	case "paused":
		return "Sedang dipause"
	case "dead":
		return "Container mati"
	case "missing":
		return "Container tidak ditemukan"
	default:
		return "Status belum diketahui"
	}
}

func parseDockerTimestamp(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" || value == "0001-01-01T00:00:00Z" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return nil
	}
	return &parsed
}

func humanizeRouteObservation(observation string) string {
	observation = strings.TrimSpace(observation)
	switch {
	case observation == "":
		return ""
	case strings.Contains(observation, "route_probe_status="):
		return fmt.Sprintf("Route situs belum siap (%s)", strings.TrimPrefix(observation, "route_probe_"))
	case strings.Contains(observation, "route_probe_error"):
		return "Route situs belum merespons"
	default:
		return observation
	}
}
