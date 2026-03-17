package provisioning

import "testing"

func TestClassifyUsageLevel(t *testing.T) {
	t.Run("normal", func(t *testing.T) {
		level, overLimit := classifyUsageLevel(100, 1_000, 20, 200)
		if level != "normal" || overLimit {
			t.Fatalf("level=%q overLimit=%t", level, overLimit)
		}
	})

	t.Run("warning", func(t *testing.T) {
		level, overLimit := classifyUsageLevel(100, 1_000, 80, 200)
		if level != "warning" || overLimit {
			t.Fatalf("level=%q overLimit=%t", level, overLimit)
		}
	})

	t.Run("critical", func(t *testing.T) {
		level, overLimit := classifyUsageLevel(100, 1_000, 95, 200)
		if level != "critical" || overLimit {
			t.Fatalf("level=%q overLimit=%t", level, overLimit)
		}
	})

	t.Run("over limit", func(t *testing.T) {
		level, overLimit := classifyUsageLevel(100, 1_000, 50, 1_100)
		if level != "over_limit" || !overLimit {
			t.Fatalf("level=%q overLimit=%t", level, overLimit)
		}
	})
}
