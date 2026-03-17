package httpapi

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"moodlecloud/backend/internal/store"
)

func TestNormalizeSubdomain(t *testing.T) {
	got := normalizeSubdomain("  Demo-SMK@2026 ")
	want := "demo-smk2026"
	if got != want {
		t.Fatalf("normalizeSubdomain() = %q, want %q", got, want)
	}
}

func TestValidSubdomainRules(t *testing.T) {
	valid := []string{"smkn1jakarta", "kampus-hebat", "moodle2026"}
	for _, value := range valid {
		if !isValidSubdomain(value) {
			t.Fatalf("expected %q to be valid", value)
		}
	}

	invalid := []string{"ab", "-kampus", "kampus-", "kampus--id", "kampus.id"}
	for _, value := range invalid {
		if isValidSubdomain(value) {
			t.Fatalf("expected %q to be invalid", value)
		}
	}
}

func TestReservedSubdomain(t *testing.T) {
	if !isReservedSubdomain("admin") {
		t.Fatal("expected admin to be reserved")
	}
	if isReservedSubdomain("kampusku") {
		t.Fatal("expected kampusku to be available")
	}
}

func TestCurrentSessionID(t *testing.T) {
	t.Run("missing session", func(t *testing.T) {
		if got := currentSessionID(context.Background()); got != nil {
			t.Fatalf("currentSessionID() = %v, want nil", *got)
		}
	})

	t.Run("session in context", func(t *testing.T) {
		want := uuid.New()
		ctx := context.WithValue(context.Background(), sessionContextKey, store.Session{ID: want})

		got := currentSessionID(ctx)
		if got == nil {
			t.Fatal("currentSessionID() = nil, want session ID")
		}
		if *got != want {
			t.Fatalf("currentSessionID() = %v, want %v", *got, want)
		}
	})
}

func TestListSessionsResponseJSONIncludesCurrentSessionID(t *testing.T) {
	sessionID := uuid.New()

	payload, err := json.Marshal(listSessionsResponse{
		Sessions:         []store.Session{{ID: sessionID}},
		CurrentSessionID: &sessionID,
	})
	if err != nil {
		t.Fatalf("marshal listSessionsResponse: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}

	if _, ok := decoded["current_session_id"]; !ok {
		t.Fatal("expected current_session_id key to be present")
	}
	if got, ok := decoded["current_session_id"].(string); !ok || got != sessionID.String() {
		t.Fatalf("current_session_id = %#v, want %q", decoded["current_session_id"], sessionID.String())
	}
}

func TestNormalizeCustomDomain(t *testing.T) {
	got := normalizeCustomDomain("  LMS.Sekolah.SCH.ID. ")
	want := "lms.sekolah.sch.id"
	if got != want {
		t.Fatalf("normalizeCustomDomain() = %q, want %q", got, want)
	}
}

func TestValidCustomDomainRules(t *testing.T) {
	valid := []string{"lms.sekolah.sch.id", "kelas.demo.kampus.ac.id"}
	for _, value := range valid {
		if !isValidCustomDomain(value) {
			t.Fatalf("expected %q to be valid", value)
		}
	}

	invalid := []string{"example.com", "https://example.com", "lms..kampus.id", "-demo.kampus.id", "127.0.0.1"}
	for _, value := range invalid {
		if isValidCustomDomain(value) {
			t.Fatalf("expected %q to be invalid", value)
		}
	}
}
