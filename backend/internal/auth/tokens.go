package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	mathrand "math/rand"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func ComparePassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

func NewOpaqueToken() (string, error) {
	return newRandomString(32)
}

func NewSessionSecret() (string, error) {
	return newRandomString(32)
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func CompareTokenHash(expectedHash, raw string) bool {
	actual := HashToken(raw)
	return subtle.ConstantTimeCompare([]byte(expectedHash), []byte(actual)) == 1
}

func NewVerificationCode() string {
	source := mathrand.New(mathrand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("%06d", source.Intn(1000000))
}

func SanitizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func newRandomString(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
