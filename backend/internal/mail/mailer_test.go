package mail

import "testing"

func TestPasswordResetURL(t *testing.T) {
	mailer := NewSMTPMailer("", 0, "no-reply@example.com", "http://localhost:3000/")

	got := mailer.passwordResetURL("token with spaces")
	want := "http://localhost:3000/reset-password?token=token+with+spaces"

	if got != want {
		t.Fatalf("passwordResetURL() = %q, want %q", got, want)
	}
}
