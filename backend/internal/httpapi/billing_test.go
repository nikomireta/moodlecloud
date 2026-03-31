package httpapi

import (
	"net/url"
	"testing"

	"github.com/google/uuid"
)

func TestBuildCheckoutReturnURLUsesInvoiceUUID(t *testing.T) {
	invoiceID := uuid.MustParse("a8f6e4cd-de6f-4ba4-bad3-6e3b90791b6d")
	got := buildCheckoutReturnURL("https://example.com/", invoiceID)

	parsed, err := url.Parse(got)
	if err != nil {
		t.Fatalf("url.Parse() error = %v", err)
	}
	if parsed.Host != "example.com" {
		t.Fatalf("host = %q, want example.com", parsed.Host)
	}
	if parsed.Path != "/checkout/"+invoiceID.String() {
		t.Fatalf("path = %q, want /checkout/%s", parsed.Path, invoiceID.String())
	}
	if raw := parsed.RawQuery; raw != "" {
		t.Fatalf("raw query = %q, want empty", raw)
	}
}
