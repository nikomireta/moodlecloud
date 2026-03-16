package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnvFileSetsMissingValuesOnly(t *testing.T) {
	tempDir := t.TempDir()
	envPath := filepath.Join(tempDir, ".env")

	if err := os.WriteFile(envPath, []byte("APP_ENV=development\nHTTP_ADDR=:9999\n"), 0o644); err != nil {
		t.Fatalf("write env file: %v", err)
	}

	t.Setenv("APP_ENV", "production")
	if err := loadDotEnvFile(envPath); err != nil {
		t.Fatalf("loadDotEnvFile() error = %v", err)
	}

	if got := os.Getenv("APP_ENV"); got != "production" {
		t.Fatalf("APP_ENV = %q, want %q", got, "production")
	}
	if got := os.Getenv("HTTP_ADDR"); got != ":9999" {
		t.Fatalf("HTTP_ADDR = %q, want %q", got, ":9999")
	}
}

func TestLoadDotEnvFileMissingIsIgnored(t *testing.T) {
	if err := loadDotEnvFile(filepath.Join(t.TempDir(), "missing.env")); err != nil {
		t.Fatalf("loadDotEnvFile() error = %v, want nil", err)
	}
}
