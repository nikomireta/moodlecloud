package billing

import "testing"

func TestIsPaidStatus(t *testing.T) {
	cases := []struct {
		name              string
		transactionStatus string
		fraudStatus       string
		want              bool
	}{
		{name: "settlement", transactionStatus: "settlement", want: true},
		{name: "capture accept", transactionStatus: "capture", fraudStatus: "accept", want: true},
		{name: "capture challenge", transactionStatus: "capture", fraudStatus: "challenge", want: false},
		{name: "pending", transactionStatus: "pending", want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsPaidStatus(tc.transactionStatus, tc.fraudStatus); got != tc.want {
				t.Fatalf("IsPaidStatus(%q, %q) = %t, want %t", tc.transactionStatus, tc.fraudStatus, got, tc.want)
			}
		})
	}
}

func TestMidtransSignature(t *testing.T) {
	got := MidtransSignature("order-123", "200", "499000.00", "server-key")
	want := "8e13e7f75b429843604148c5550f6e8406075699092d16f4cb2004448d85155112cc2a0029822955335431ba1c8a22ff9fbc8aff9b8c092691d2e2d794041948"
	if got != want {
		t.Fatalf("MidtransSignature() = %q, want %q", got, want)
	}
}

func TestApplyMidtransFinishCallback(t *testing.T) {
	payload := map[string]any{}
	applyMidtransFinishCallback(payload, "https://example.com/checkout?invoice_id=abc")

	callbacks, ok := payload["callbacks"].(map[string]any)
	if !ok {
		t.Fatalf("callbacks payload missing or wrong type: %#v", payload["callbacks"])
	}
	if got := callbacks["finish"]; got != "https://example.com/checkout?invoice_id=abc" {
		t.Fatalf("callbacks.finish = %#v, want redirect URL", got)
	}
}
