package httpapi

import (
	"testing"

	"github.com/google/uuid"

	"moodlepilot/backend/internal/config"
	"moodlepilot/backend/internal/store"
)

func TestSiteReportConnectionHasCapability(t *testing.T) {
	connection := store.SiteReportConnection{
		SiteID:       uuid.New(),
		Capabilities: []string{"summary_metrics_v1", " ADMIN_ACCESS_V1 "},
	}

	if !siteReportConnectionHasCapability(connection, "admin_access_v1") {
		t.Fatalf("siteReportConnectionHasCapability should match normalized capability")
	}
	if siteReportConnectionHasCapability(connection, "missing_capability") {
		t.Fatalf("siteReportConnectionHasCapability unexpectedly matched missing capability")
	}
}

func TestBuildSiteAdminAccessLoginURL(t *testing.T) {
	cfg := config.Config{
		SiteBaseDomain: "lvh.me",
		SiteURLScheme:  "http",
	}

	site := store.Site{
		Subdomain: "kelas-a",
		SiteURL:   "http://kelas-a.example.test/",
	}

	got := buildSiteAdminAccessLoginURL(cfg, site, "abc123")
	want := "http://kelas-a.example.test/local/moodlepilot_report/admin_access.php?t=abc123"
	if got != want {
		t.Fatalf("buildSiteAdminAccessLoginURL() = %q, want %q", got, want)
	}

	site.SiteURL = ""
	got = buildSiteAdminAccessLoginURL(cfg, site, "abc123")
	want = "http://kelas-a.lvh.me/local/moodlepilot_report/admin_access.php?t=abc123"
	if got != want {
		t.Fatalf("buildSiteAdminAccessLoginURL() fallback = %q, want %q", got, want)
	}
}
