package billing

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"moodlepilot/backend/internal/config"
)

const (
	ProviderMidtrans = "midtrans"
	ProviderMock     = "mock"
)

type PublicConfig struct {
	Provider                 string `json:"provider"`
	Enabled                  bool   `json:"enabled"`
	Environment              string `json:"environment"`
	ClientKey                string `json:"client_key"`
	ScriptURL                string `json:"script_url"`
	SupportsCardTokenization bool   `json:"supports_card_tokenization"`
}

type Customer struct {
	ReferenceID  string `json:"reference_id"`
	FullName     string `json:"full_name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Organization string `json:"organization"`
}

type Item struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Quantity    int    `json:"quantity"`
	Price       int64  `json:"price"`
}

type ChargeRequest struct {
	OrderID           string   `json:"order_id"`
	Amount            int64    `json:"amount"`
	Currency          string   `json:"currency"`
	PaymentMethodType string   `json:"payment_method_type"`
	CardTokenID       string   `json:"card_token_id"`
	SaveCard          bool     `json:"save_card"`
	Customer          Customer `json:"customer"`
	Items             []Item   `json:"items"`
	ReturnURL         string   `json:"return_url"`
}

type SavedCardChargeRequest struct {
	OrderID      string   `json:"order_id"`
	Amount       int64    `json:"amount"`
	Currency     string   `json:"currency"`
	SavedTokenID string   `json:"saved_token_id"`
	Customer     Customer `json:"customer"`
	Items        []Item   `json:"items"`
}

type ChargeResponse struct {
	Provider          string          `json:"provider"`
	OrderID           string          `json:"order_id"`
	StatusCode        string          `json:"status_code"`
	StatusMessage     string          `json:"status_message"`
	TransactionStatus string          `json:"transaction_status"`
	FraudStatus       string          `json:"fraud_status"`
	PaymentMethodType string          `json:"payment_method_type"`
	CheckoutURL       string          `json:"checkout_url"`
	RedirectURL       string          `json:"redirect_url"`
	ExpiresAt         *time.Time      `json:"expires_at,omitempty"`
	PaidAt            *time.Time      `json:"paid_at,omitempty"`
	SavedTokenID      string          `json:"saved_token_id"`
	CardBrand         string          `json:"card_brand"`
	MaskedCard        string          `json:"masked_card"`
	Raw               json.RawMessage `json:"raw"`
}

type StatusNotification struct {
	Provider          string          `json:"provider"`
	ExternalID        string          `json:"external_id"`
	EventType         string          `json:"event_type"`
	StatusCode        string          `json:"status_code"`
	GrossAmount       string          `json:"gross_amount"`
	TransactionStatus string          `json:"transaction_status"`
	FraudStatus       string          `json:"fraud_status"`
	PaymentMethodType string          `json:"payment_method_type"`
	SignatureKey      string          `json:"signature_key"`
	SavedTokenID      string          `json:"saved_token_id"`
	CardBrand         string          `json:"card_brand"`
	MaskedCard        string          `json:"masked_card"`
	RedirectURL       string          `json:"redirect_url"`
	CheckoutURL       string          `json:"checkout_url"`
	ExpiresAt         *time.Time      `json:"expires_at,omitempty"`
	PaidAt            *time.Time      `json:"paid_at,omitempty"`
	Raw               json.RawMessage `json:"raw"`
}

type Provider interface {
	Name() string
	PublicConfig() PublicConfig
	CreateCheckout(ctx context.Context, req ChargeRequest) (ChargeResponse, error)
	ChargeSavedCard(ctx context.Context, req SavedCardChargeRequest) (ChargeResponse, error)
	CheckTransaction(ctx context.Context, orderID string) (ChargeResponse, error)
	ParseWebhook(payload []byte) (StatusNotification, error)
	VerifyWebhookSignature(notification StatusNotification) error
}

func NewProvider(cfg config.Config) Provider {
	if strings.TrimSpace(cfg.MidtransServerKey) == "" || strings.TrimSpace(cfg.MidtransClientKey) == "" {
		return newMockProvider(cfg)
	}
	return newMidtransProvider(cfg)
}

func IsPaidStatus(transactionStatus, fraudStatus string) bool {
	transactionStatus = strings.ToLower(strings.TrimSpace(transactionStatus))
	fraudStatus = strings.ToLower(strings.TrimSpace(fraudStatus))
	switch transactionStatus {
	case "settlement":
		return true
	case "capture":
		return fraudStatus == "" || fraudStatus == "accept"
	default:
		return false
	}
}

func IsPendingStatus(transactionStatus, fraudStatus string) bool {
	transactionStatus = strings.ToLower(strings.TrimSpace(transactionStatus))
	fraudStatus = strings.ToLower(strings.TrimSpace(fraudStatus))
	if transactionStatus == "capture" && fraudStatus == "challenge" {
		return true
	}
	switch transactionStatus {
	case "pending", "authorize":
		return true
	default:
		return false
	}
}

func IsFailureStatus(transactionStatus string) bool {
	switch strings.ToLower(strings.TrimSpace(transactionStatus)) {
	case "deny", "cancel", "expire", "failure":
		return true
	default:
		return false
	}
}

func PeriodEnd(start time.Time, billingCycle string) time.Time {
	switch strings.ToLower(strings.TrimSpace(billingCycle)) {
	case "yearly":
		return start.AddDate(1, 0, 0)
	default:
		return start.AddDate(0, 1, 0)
	}
}

func ptrTime(value time.Time) *time.Time {
	utc := value.UTC()
	return &utc
}

func MidtransSignature(orderID, statusCode, grossAmount, serverKey string) string {
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	return hex.EncodeToString(sum[:])
}

func maskLast4(masked string) string {
	trimmed := strings.TrimSpace(masked)
	if len(trimmed) < 4 {
		return trimmed
	}
	return trimmed[len(trimmed)-4:]
}

func trimPhone(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return value
	}
	if strings.HasPrefix(value, "+") {
		return value
	}
	if strings.HasPrefix(value, "0") {
		return "+62" + strings.TrimPrefix(value, "0")
	}
	return value
}

func mustJSON(value any) json.RawMessage {
	raw, err := json.Marshal(value)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return raw
}

func unsupportedWebhook(provider string) error {
	return fmt.Errorf("webhook tidak didukung untuk provider %s", provider)
}
