package config

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv                  string
	HTTPAddr                string
	FrontendOrigin          string
	DatabaseURL             string
	SiteDBAdminURL          string
	RedisAddr               string
	RedisPassword           string
	SMTPHost                string
	SMTPPort                int
	SMTPFrom                string
	SessionCookieName       string
	SessionTTL              time.Duration
	RememberMeTTL           time.Duration
	PasswordResetTTL        time.Duration
	VerifyEmailTTL          time.Duration
	ProvisioningRuntimeMode string
	SiteBaseDomain          string
	SiteURLScheme           string
	DockerProxyNetwork      string
	TraefikAPIURL           string
	MoodleImageRepository   string
	MoodleImageTag          string
	SiteRuntimeSecret       string
	UsageMeterSchedule      string
	HostStorageBudgetBytes  int64
	HostCPUMillicoresBudget int
	HostMemoryMiBBudget     int
	DockerWebPidsLimit      int64
	DockerCronPidsLimit     int64
	RunMigrations           bool
	SeedPlaywrightUser      bool
	PlaywrightSeedName      string
	PlaywrightSeedEmail     string
	PlaywrightSeedPassword  string
	PlaywrightSeedCompany   string
	PlaywrightSeedOrg       string
}

func Load() (Config, error) {
	if err := loadDotEnvFiles(".env", "backend/.env"); err != nil {
		return Config{}, err
	}

	cfg := Config{
		AppEnv:                  getEnv("APP_ENV", "development"),
		HTTPAddr:                getEnv("HTTP_ADDR", ":8080"),
		FrontendOrigin:          getEnv("FRONTEND_ORIGIN", "http://localhost:3000"),
		DatabaseURL:             getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/moodlecloud?sslmode=disable"),
		SiteDBAdminURL:          getEnv("SITE_DB_ADMIN_URL", "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"),
		RedisAddr:               getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:           os.Getenv("REDIS_PASSWORD"),
		SMTPHost:                getEnv("SMTP_HOST", "localhost"),
		SMTPFrom:                getEnv("SMTP_FROM", "no-reply@moodlecloud.local"),
		SessionCookieName:       getEnv("SESSION_COOKIE_NAME", "moodlecloud_session"),
		ProvisioningRuntimeMode: getEnv("PROVISIONING_RUNTIME_MODE", "docker_local"),
		SiteBaseDomain:          getEnv("SITE_BASE_DOMAIN", "lvh.me"),
		SiteURLScheme:           getEnv("SITE_URL_SCHEME", "http"),
		DockerProxyNetwork:      getEnv("DOCKER_PROXY_NETWORK", "moodlecloud-proxy"),
		TraefikAPIURL:           getEnv("TRAEFIK_API_URL", "http://127.0.0.1:8088"),
		MoodleImageRepository:   getEnv("MOODLE_IMAGE_REPOSITORY", "local/moodle-app"),
		MoodleImageTag:          getEnv("MOODLE_IMAGE_TAG", "5.1-local"),
		SiteRuntimeSecret:       getEnv("SITE_RUNTIME_SECRET", "local-runtime-secret"),
		UsageMeterSchedule:      getEnv("USAGE_METER_SCHEDULE", "@every 5m"),
		RunMigrations:           getEnv("RUN_MIGRATIONS", "true") != "false",
		PlaywrightSeedName:      getEnv("PLAYWRIGHT_SEED_NAME", "Playwright Test"),
		PlaywrightSeedEmail:     getEnv("PLAYWRIGHT_SEED_EMAIL", "playwright@example.com"),
		PlaywrightSeedPassword:  getEnv("PLAYWRIGHT_SEED_PASSWORD", "Playwright123!"),
		PlaywrightSeedCompany:   getEnv("PLAYWRIGHT_SEED_COMPANY", "Playwright QA"),
		PlaywrightSeedOrg:       getEnv("PLAYWRIGHT_SEED_ORGANIZATION", "Playwright Testing"),
	}
	cfg.SeedPlaywrightUser = getEnv("SEED_PLAYWRIGHT_USER", cfg.AppEnv) == "development"
	if value := os.Getenv("SEED_PLAYWRIGHT_USER"); value != "" {
		cfg.SeedPlaywrightUser = value != "false"
	}

	smtpPort, err := strconv.Atoi(getEnv("SMTP_PORT", "1025"))
	if err != nil {
		return Config{}, fmt.Errorf("parse SMTP_PORT: %w", err)
	}
	cfg.SMTPPort = smtpPort

	sessionTTLHours, err := strconv.Atoi(getEnv("SESSION_TTL_HOURS", "24"))
	if err != nil {
		return Config{}, fmt.Errorf("parse SESSION_TTL_HOURS: %w", err)
	}
	cfg.SessionTTL = time.Duration(sessionTTLHours) * time.Hour

	rememberTTLHours, err := strconv.Atoi(getEnv("REMEMBER_ME_TTL_HOURS", "720"))
	if err != nil {
		return Config{}, fmt.Errorf("parse REMEMBER_ME_TTL_HOURS: %w", err)
	}
	cfg.RememberMeTTL = time.Duration(rememberTTLHours) * time.Hour

	passwordResetTTLMinutes, err := strconv.Atoi(getEnv("PASSWORD_RESET_TTL_MINUTES", "30"))
	if err != nil {
		return Config{}, fmt.Errorf("parse PASSWORD_RESET_TTL_MINUTES: %w", err)
	}
	cfg.PasswordResetTTL = time.Duration(passwordResetTTLMinutes) * time.Minute

	verifyEmailTTLMinutes, err := strconv.Atoi(getEnv("VERIFY_EMAIL_TTL_MINUTES", "15"))
	if err != nil {
		return Config{}, fmt.Errorf("parse VERIFY_EMAIL_TTL_MINUTES: %w", err)
	}
	cfg.VerifyEmailTTL = time.Duration(verifyEmailTTLMinutes) * time.Minute

	hostStorageBudgetBytes, err := strconv.ParseInt(getEnv("HOST_STORAGE_BUDGET_BYTES", "536870912000"), 10, 64)
	if err != nil {
		return Config{}, fmt.Errorf("parse HOST_STORAGE_BUDGET_BYTES: %w", err)
	}
	cfg.HostStorageBudgetBytes = hostStorageBudgetBytes

	hostCPUMillicoresBudget, err := strconv.Atoi(getEnv("HOST_CPU_MILLICORES_BUDGET", fmt.Sprintf("%d", runtime.NumCPU()*1000)))
	if err != nil {
		return Config{}, fmt.Errorf("parse HOST_CPU_MILLICORES_BUDGET: %w", err)
	}
	cfg.HostCPUMillicoresBudget = hostCPUMillicoresBudget

	defaultMemoryBudget := detectHostMemoryMiB() * 3 / 4
	if defaultMemoryBudget <= 0 {
		defaultMemoryBudget = 8192
	}
	hostMemoryMiBBudget, err := strconv.Atoi(getEnv("HOST_MEMORY_MIB_BUDGET", fmt.Sprintf("%d", defaultMemoryBudget)))
	if err != nil {
		return Config{}, fmt.Errorf("parse HOST_MEMORY_MIB_BUDGET: %w", err)
	}
	cfg.HostMemoryMiBBudget = hostMemoryMiBBudget

	webPidsLimit, err := strconv.ParseInt(getEnv("DOCKER_WEB_PIDS_LIMIT", "256"), 10, 64)
	if err != nil {
		return Config{}, fmt.Errorf("parse DOCKER_WEB_PIDS_LIMIT: %w", err)
	}
	cfg.DockerWebPidsLimit = webPidsLimit

	cronPidsLimit, err := strconv.ParseInt(getEnv("DOCKER_CRON_PIDS_LIMIT", "128"), 10, 64)
	if err != nil {
		return Config{}, fmt.Errorf("parse DOCKER_CRON_PIDS_LIMIT: %w", err)
	}
	cfg.DockerCronPidsLimit = cronPidsLimit

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func loadDotEnvFiles(paths ...string) error {
	for _, path := range paths {
		if err := loadDotEnvFile(path); err != nil {
			return err
		}
	}
	return nil
}

func loadDotEnvFile(path string) error {
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return fmt.Errorf("parse %s:%d: expected KEY=VALUE", path, lineNumber)
		}

		key = strings.TrimSpace(key)
		if key == "" {
			return fmt.Errorf("parse %s:%d: key is empty", path, lineNumber)
		}

		if _, exists := os.LookupEnv(key); exists {
			continue
		}

		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if err := os.Setenv(key, value); err != nil {
			return fmt.Errorf("set env %s from %s:%d: %w", key, path, lineNumber, err)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan %s: %w", path, err)
	}

	return nil
}

func detectHostMemoryMiB() int {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(data), "\n") {
		if !strings.HasPrefix(line, "MemTotal:") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			return 0
		}
		valueKiB, err := strconv.Atoi(fields[1])
		if err != nil {
			return 0
		}
		return valueKiB / 1024
	}
	return 0
}
