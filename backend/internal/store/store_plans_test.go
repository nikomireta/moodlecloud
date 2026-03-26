package store

import "testing"

func TestIsSelfServePlanCode(t *testing.T) {
	testCases := []struct {
		name string
		code string
		want bool
	}{
		{name: "kelas 10", code: "kelas-10", want: true},
		{name: "kelas 50", code: "kelas-50", want: true},
		{name: "kelas 100", code: "kelas-100", want: true},
		{name: "trimmed code", code: " kelas-10 ", want: true},
		{name: "institusi plan", code: "institusi-300", want: false},
		{name: "skala plan", code: "skala-1000", want: false},
		{name: "empty", code: "", want: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsSelfServePlanCode(tc.code); got != tc.want {
				t.Fatalf("IsSelfServePlanCode(%q) = %t, want %t", tc.code, got, tc.want)
			}
		})
	}
}

func TestSelfServeDefaultRegion(t *testing.T) {
	if SelfServeDefaultRegion != "jakarta" {
		t.Fatalf("SelfServeDefaultRegion = %q, want %q", SelfServeDefaultRegion, "jakarta")
	}
}

func TestIsSelfServeUpgradePath(t *testing.T) {
	testCases := []struct {
		name    string
		current string
		target  string
		want    bool
	}{
		{name: "upgrade kelas 10 ke 50", current: "kelas-10", target: "kelas-50", want: true},
		{name: "upgrade kelas 50 ke 100", current: "kelas-50", target: "kelas-100", want: true},
		{name: "same plan rejected", current: "kelas-50", target: "kelas-50", want: false},
		{name: "downgrade rejected", current: "kelas-100", target: "kelas-50", want: false},
		{name: "institusi target rejected", current: "kelas-50", target: "institusi-300", want: false},
		{name: "starter to kelas 100 allowed", current: "starter", target: "kelas-100", want: true},
		{name: "starter to kelas 50 rejected", current: "starter", target: "kelas-50", want: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsSelfServeUpgradePath(tc.current, tc.target); got != tc.want {
				t.Fatalf("IsSelfServeUpgradePath(%q, %q) = %t, want %t", tc.current, tc.target, got, tc.want)
			}
		})
	}
}

func TestCanSelfServeUpgradeFromPlanCode(t *testing.T) {
	testCases := []struct {
		name string
		code string
		want bool
	}{
		{name: "kelas self serve", code: "kelas-10", want: true},
		{name: "starter legacy", code: "starter", want: true},
		{name: "institusi rejected", code: "institusi-300", want: false},
		{name: "empty rejected", code: "", want: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if got := CanSelfServeUpgradeFromPlanCode(tc.code); got != tc.want {
				t.Fatalf("CanSelfServeUpgradeFromPlanCode(%q) = %t, want %t", tc.code, got, tc.want)
			}
		})
	}
}
