package billing

import (
	"context"
	"fmt"
	"strings"
	"time"

	"moodlepilot/backend/internal/config"
)

type mockProvider struct {
	cfg config.Config
}

func newMockProvider(cfg config.Config) Provider {
	return &mockProvider{cfg: cfg}
}

func (p *mockProvider) Name() string {
	return ProviderMock
}

func (p *mockProvider) PublicConfig() PublicConfig {
	return PublicConfig{
		Provider:                 ProviderMock,
		Enabled:                  false,
		Environment:              p.cfg.AppEnv,
		ClientKey:                "",
		ScriptURL:                "",
		SupportsCardTokenization: false,
	}
}

func (p *mockProvider) CreateCheckout(_ context.Context, req ChargeRequest) (ChargeResponse, error) {
	now := time.Now().UTC()
	transactionStatus := "settlement"
	redirectURL := ""
	checkoutURL := ""

	switch strings.TrimSpace(req.PaymentMethodType) {
	case "bank":
		redirectURL = req.ReturnURL
		checkoutURL = req.ReturnURL
	case "ewallet":
		redirectURL = req.ReturnURL
		checkoutURL = req.ReturnURL
	}

	return ChargeResponse{
		Provider:          ProviderMock,
		OrderID:           req.OrderID,
		StatusCode:        "200",
		StatusMessage:     "Mock payment settled",
		TransactionStatus: transactionStatus,
		PaymentMethodType: req.PaymentMethodType,
		CheckoutURL:       checkoutURL,
		RedirectURL:       redirectURL,
		PaidAt:            &now,
		SavedTokenID:      fmt.Sprintf("mock-card-%s", req.OrderID),
		CardBrand:         "visa",
		MaskedCard:        "411111-1114",
		Raw: mustJSON(map[string]any{
			"provider":           ProviderMock,
			"order_id":           req.OrderID,
			"status_code":        "200",
			"transaction_status": transactionStatus,
			"payment_type":       req.PaymentMethodType,
			"paid_at":            now.Format(time.RFC3339),
		}),
	}, nil
}

func (p *mockProvider) ChargeSavedCard(_ context.Context, req SavedCardChargeRequest) (ChargeResponse, error) {
	now := time.Now().UTC()
	return ChargeResponse{
		Provider:          ProviderMock,
		OrderID:           req.OrderID,
		StatusCode:        "200",
		StatusMessage:     "Mock renewal settled",
		TransactionStatus: "settlement",
		PaymentMethodType: "card",
		PaidAt:            &now,
		SavedTokenID:      req.SavedTokenID,
		CardBrand:         "visa",
		MaskedCard:        "411111-1114",
		Raw: mustJSON(map[string]any{
			"provider":           ProviderMock,
			"order_id":           req.OrderID,
			"status_code":        "200",
			"transaction_status": "settlement",
			"payment_type":       "card",
			"paid_at":            now.Format(time.RFC3339),
		}),
	}, nil
}

func (p *mockProvider) CheckTransaction(_ context.Context, orderID string) (ChargeResponse, error) {
	now := time.Now().UTC()
	return ChargeResponse{
		Provider:          ProviderMock,
		OrderID:           orderID,
		StatusCode:        "200",
		StatusMessage:     "Mock payment settled",
		TransactionStatus: "settlement",
		PaymentMethodType: "card",
		PaidAt:            &now,
		Raw:               mustJSON(map[string]any{"order_id": orderID, "transaction_status": "settlement"}),
	}, nil
}

func (p *mockProvider) ParseWebhook(_ []byte) (StatusNotification, error) {
	return StatusNotification{}, unsupportedWebhook(ProviderMock)
}

func (p *mockProvider) VerifyWebhookSignature(_ StatusNotification) error {
	return unsupportedWebhook(ProviderMock)
}
