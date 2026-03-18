package provisioning

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/pkg/stdcopy"

	"moodlepilot/backend/internal/store"
)

type siteBackupManifest struct {
	BackupID    string                    `json:"backup_id"`
	SiteID      string                    `json:"site_id"`
	SiteName    string                    `json:"site_name"`
	Subdomain   string                    `json:"subdomain"`
	Trigger     string                    `json:"trigger"`
	RuntimeMode string                    `json:"runtime_mode"`
	CreatedAt   time.Time                 `json:"created_at"`
	Runtime     store.SiteRuntimeMetadata `json:"runtime"`
	Artifacts   []string                  `json:"artifacts"`
}

func (r *DockerLocalRuntime) CreateSiteBackupArchive(ctx context.Context, site store.Site, job store.ProvisioningJob, metadata store.SiteRuntimeMetadata, backup store.SiteBackup) (archivePath string, cleanup func(), err error) {
	tempDir, err := os.MkdirTemp("", "moodlepilot-backup-*")
	if err != nil {
		return "", nil, fmt.Errorf("create backup temp dir: %w", err)
	}
	cleanup = func() {
		_ = os.RemoveAll(tempDir)
	}

	maintenanceEnabled := false
	cronWasRunning := false
	defer func() {
		restoreCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		if maintenanceEnabled {
			if disableErr := r.setMaintenanceMode(restoreCtx, metadata.WebContainerName, false); disableErr != nil {
				err = errors.Join(err, fmt.Errorf("disable maintenance mode: %w", disableErr))
			}
		}
		if cronWasRunning {
			if startErr := r.startContainerIfNeeded(restoreCtx, metadata.CronContainerName); startErr != nil {
				err = errors.Join(err, fmt.Errorf("restart cron container: %w", startErr))
			}
		}
		if err != nil && cleanup != nil {
			cleanup()
			cleanup = nil
		}
	}()

	if err = r.setMaintenanceMode(ctx, metadata.WebContainerName, true); err != nil {
		return "", cleanup, err
	}
	maintenanceEnabled = true

	cronWasRunning, err = r.containerRunning(ctx, metadata.CronContainerName)
	if err != nil {
		return "", cleanup, err
	}
	if cronWasRunning {
		if err = r.stopContainerIfNeeded(ctx, metadata.CronContainerName); err != nil {
			return "", cleanup, err
		}
	}

	postgresContainer, err := r.composeServiceContainerID(ctx, r.cfg.BackupDockerPostgresSvc)
	if err != nil {
		return "", cleanup, err
	}

	databaseDumpPath := filepath.Join(tempDir, "database.sql.gz")
	if err = r.captureDatabaseDump(ctx, postgresContainer, metadata.DatabaseName, databaseDumpPath); err != nil {
		return "", cleanup, err
	}

	moodleDataPath := filepath.Join(tempDir, "moodledata.tar.gz")
	if err = r.captureMoodleDataArchive(ctx, metadata.WebContainerName, moodleDataPath); err != nil {
		return "", cleanup, err
	}

	manifestBytes, err := json.MarshalIndent(siteBackupManifest{
		BackupID:    backup.ID.String(),
		SiteID:      site.ID.String(),
		SiteName:    site.Name,
		Subdomain:   site.Subdomain,
		Trigger:     backup.Trigger,
		RuntimeMode: job.RuntimeMode,
		CreatedAt:   time.Now().UTC(),
		Runtime:     metadata,
		Artifacts:   []string{"manifest.json", "database.sql.gz", "moodledata.tar.gz"},
	}, "", "  ")
	if err != nil {
		return "", cleanup, fmt.Errorf("marshal backup manifest: %w", err)
	}

	archivePath = filepath.Join(tempDir, "site-backup.tar.gz")
	if err = createBackupArchive(archivePath, manifestBytes, databaseDumpPath, moodleDataPath); err != nil {
		return "", cleanup, err
	}

	return archivePath, cleanup, nil
}

func (r *DockerLocalRuntime) setMaintenanceMode(ctx context.Context, webContainerName string, enabled bool) error {
	action := "--disable"
	if enabled {
		action = "--enable"
	}
	if err := r.execInContainer(ctx, webContainerName, "www-data", []string{
		"php",
		"/var/www/html/admin/cli/maintenance.php",
		action,
	}); err != nil {
		return fmt.Errorf("toggle maintenance mode in %s: %w", webContainerName, err)
	}
	return nil
}

func (r *DockerLocalRuntime) containerRunning(ctx context.Context, containerName string) (bool, error) {
	inspect, err := r.docker.ContainerInspect(ctx, containerName)
	if err != nil {
		return false, fmt.Errorf("inspect container %s: %w", containerName, err)
	}
	return inspect.State != nil && inspect.State.Running, nil
}

func (r *DockerLocalRuntime) composeServiceContainerID(ctx context.Context, serviceName string) (string, error) {
	serviceName = strings.TrimSpace(serviceName)
	if serviceName == "" {
		return "", fmt.Errorf("backup postgres service belum dikonfigurasi")
	}

	items, err := r.docker.ContainerList(ctx, container.ListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("label", "com.docker.compose.service="+serviceName),
		),
	})
	if err != nil {
		return "", fmt.Errorf("list compose service container %s: %w", serviceName, err)
	}
	if len(items) == 0 {
		return "", fmt.Errorf("container docker compose service %s tidak ditemukan", serviceName)
	}

	for _, item := range items {
		if item.State == "running" {
			return item.ID, nil
		}
	}
	return items[0].ID, nil
}

func (r *DockerLocalRuntime) captureDatabaseDump(ctx context.Context, postgresContainerName, databaseName, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create database dump file: %w", err)
	}
	defer file.Close()

	gzipWriter := gzip.NewWriter(file)
	stderr := &bytes.Buffer{}
	if err := r.execToWritersInContainer(ctx, postgresContainerName, "postgres", []string{
		"pg_dump",
		"--clean",
		"--if-exists",
		"--no-owner",
		"--no-privileges",
		fmt.Sprintf("--dbname=%s", databaseName),
	}, gzipWriter, stderr); err != nil {
		_ = gzipWriter.Close()
		return fmt.Errorf("capture database dump: %w", err)
	}
	if err := gzipWriter.Close(); err != nil {
		return fmt.Errorf("finalize database dump gzip: %w", err)
	}
	return nil
}

func (r *DockerLocalRuntime) captureMoodleDataArchive(ctx context.Context, webContainerName, outputPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create moodledata archive file: %w", err)
	}
	defer file.Close()

	stderr := &bytes.Buffer{}
	if err := r.execToWritersInContainer(ctx, webContainerName, "root", []string{
		"tar",
		"-czf",
		"-",
		"-C",
		"/var/www",
		"moodledata",
	}, file, stderr); err != nil {
		return fmt.Errorf("capture moodledata archive: %w", err)
	}
	return nil
}

func (r *DockerLocalRuntime) execToWritersInContainer(ctx context.Context, containerName, user string, cmd []string, stdoutWriter io.Writer, stderrWriter io.Writer) error {
	if stdoutWriter == nil {
		stdoutWriter = io.Discard
	}
	var stderr bytes.Buffer
	if stderrWriter == nil {
		stderrWriter = &stderr
	} else {
		stderrWriter = io.MultiWriter(stderrWriter, &stderr)
	}

	execResp, err := r.docker.ContainerExecCreate(ctx, containerName, container.ExecOptions{
		User:         user,
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	})
	if err != nil {
		return fmt.Errorf("create exec in %s: %w", containerName, err)
	}

	hijacked, err := r.docker.ContainerExecAttach(ctx, execResp.ID, container.ExecAttachOptions{})
	if err != nil {
		return fmt.Errorf("attach exec in %s: %w", containerName, err)
	}
	defer hijacked.Close()

	if _, err := stdcopy.StdCopy(stdoutWriter, stderrWriter, hijacked.Reader); err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("read exec output in %s: %w", containerName, err)
	}

	if err := r.waitForExecExit(ctx, containerName, execResp.ID, cmd); err != nil {
		if text := strings.TrimSpace(stderr.String()); text != "" {
			return fmt.Errorf("%w: %s", err, text)
		}
		return err
	}
	return nil
}

func createBackupArchive(outputPath string, manifest []byte, databaseDumpPath, moodleDataPath string) error {
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create backup archive: %w", err)
	}
	defer file.Close()

	gzipWriter := gzip.NewWriter(file)
	tarWriter := tar.NewWriter(gzipWriter)

	if err := writeTarBytes(tarWriter, "manifest.json", manifest, time.Now().UTC()); err != nil {
		_ = tarWriter.Close()
		_ = gzipWriter.Close()
		return err
	}
	if err := writeTarFile(tarWriter, "database.sql.gz", databaseDumpPath); err != nil {
		_ = tarWriter.Close()
		_ = gzipWriter.Close()
		return err
	}
	if err := writeTarFile(tarWriter, "moodledata.tar.gz", moodleDataPath); err != nil {
		_ = tarWriter.Close()
		_ = gzipWriter.Close()
		return err
	}
	if err := tarWriter.Close(); err != nil {
		_ = gzipWriter.Close()
		return fmt.Errorf("close backup tar writer: %w", err)
	}
	if err := gzipWriter.Close(); err != nil {
		return fmt.Errorf("close backup gzip writer: %w", err)
	}
	return nil
}

func writeTarBytes(writer *tar.Writer, name string, payload []byte, modTime time.Time) error {
	header := &tar.Header{
		Name:    name,
		Mode:    0o600,
		Size:    int64(len(payload)),
		ModTime: modTime,
	}
	if err := writer.WriteHeader(header); err != nil {
		return fmt.Errorf("write tar header %s: %w", name, err)
	}
	if _, err := writer.Write(payload); err != nil {
		return fmt.Errorf("write tar payload %s: %w", name, err)
	}
	return nil
}

func writeTarFile(writer *tar.Writer, name, sourcePath string) error {
	file, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("open backup artifact %s: %w", sourcePath, err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat backup artifact %s: %w", sourcePath, err)
	}

	header := &tar.Header{
		Name:    name,
		Mode:    0o600,
		Size:    info.Size(),
		ModTime: info.ModTime(),
	}
	if err := writer.WriteHeader(header); err != nil {
		return fmt.Errorf("write tar header %s: %w", name, err)
	}
	if _, err := io.Copy(writer, file); err != nil {
		return fmt.Errorf("copy backup artifact %s: %w", name, err)
	}
	return nil
}
