package auth

import "testing"

func TestPasswordHashAndCompare(t *testing.T) {
	hash, err := HashPassword("SuperSecret123")
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}

	if err := ComparePassword(hash, "SuperSecret123"); err != nil {
		t.Fatalf("ComparePassword returned error: %v", err)
	}

	if err := ComparePassword(hash, "WrongPassword123"); err == nil {
		t.Fatal("ComparePassword expected error for wrong password")
	}
}

func TestTokenHashCompare(t *testing.T) {
	token, err := NewOpaqueToken()
	if err != nil {
		t.Fatalf("NewOpaqueToken returned error: %v", err)
	}

	hash := HashToken(token)
	if !CompareTokenHash(hash, token) {
		t.Fatal("CompareTokenHash should return true for the same token")
	}

	if CompareTokenHash(hash, token+"x") {
		t.Fatal("CompareTokenHash should return false for a different token")
	}
}
