package billing

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"moodlepilot/backend/internal/config"
)

type midtransProvider struct {
	serverKey  string
	clientKey  string
	merchantID string
	env        string
	apiBaseURL string
	snapURL    string
	httpClient *http.Client
}

type midtransResponse struct {
	StatusCode        string `json:"status_code"`
	StatusMessage     string `json:"status_message"`
	OrderID           string `json:"order_id"`
	GrossAmount       string `json:"gross_amount"`
	PaymentType       string `json:"payment_type"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	RedirectURL       string `json:"redirect_url"`
	SavedTokenID      string `json:"saved_token_id"`
	CardType          string `json:"card_type"`
	MaskedCard        string `json:"masked_card"`
	ExpiryTime        string `json:"expiry_time"`
	TransactionTime   string `json:"transaction_time"`
	SettlementTime    string `json:"settlement_time"`
	SignatureKey      string `json:"signature_key"`
	Actions           []struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	} `json:"actions"`
}

type midtransSnapResponse struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
}

func newMidtransProvider(cfg config.Config) Provider {
	apiBaseURL := "https://api.midtrans.com"
	snapURL := "https://app.midtrans.com/snap/v1/transactions"
	if strings.EqualFold(strings.TrimSpace(cfg.MidtransEnv), "sandbox") {
		apiBaseURL = "https://api.sandbox.midtrans.com"
		snapURL = "https://app.sandbox.midtrans.com/snap/v1/transactions"
	}
	return &midtransProvider{
		serverKey:  strings.TrimSpace(cfg.MidtransServerKey),
		clientKey:  strings.TrimSpace(cfg.MidtransClientKey),
		merchantID: strings.TrimSpace(cfg.MidtransMerchantID),
		env:        strings.ToLower(strings.TrimSpace(cfg.MidtransEnv)),
		apiBaseURL: apiBaseURL,
		snapURL:    snapURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *midtransProvider) Name() string {
	return ProviderMidtrans
}

func (p *midtransProvider) PublicConfig() PublicConfig {
	return PublicConfig{
		Provider:                 ProviderMidtrans,
		Enabled:                  true,
		Environment:              p.env,
		ClientKey:                p.clientKey,
		ScriptURL:                "https://api.midtrans.com/v2/assets/js/midtrans-new-3ds.min.js",
		SupportsCardTokenization: true,
	}
}

func (p *midtransProvider) CreateCheckout(ctx context.Context, req ChargeRequest) (ChargeResponse, error) {
	switch strings.TrimSpace(req.PaymentMethodType) {
	case "card":
		payload := map[string]any{
			"payment_type": "credit_card",
			"credit_card": map[string]any{
				"token_id":       req.CardTokenID,
				"authentication": true,
				"save_token_id":  req.SaveCard,
			},
			"transaction_details": map[string]any{
				"order_id":     req.OrderID,
				"gross_amount": req.Amount,
			},
			"customer_details": p.customerDetails(req.Customer),
			"item_details":     p.itemDetails(req.Items),
		}
		return p.doCoreCharge(ctx, payload)
	case "bank":
		payload := map[string]any{
			"transaction_details": map[string]any{
				"order_id":     req.OrderID,
				"gross_amount": req.Amount,
			},
			"customer_details": p.customerDetails(req.Customer),
			"item_details":     p.itemDetails(req.Items),
			"enabled_payments": []string{"bank_transfer"},
		}
		applyMidtransFinishCallback(payload, req.ReturnURL)
		return p.doSnapCharge(ctx, req.OrderID, "bank", payload)
	case "ewallet":
		payload := map[string]any{
			"transaction_details": map[string]any{
				"order_id":     req.OrderID,
				"gross_amount": req.Amount,
			},
			"customer_details": p.customerDetails(req.Customer),
			"item_details":     p.itemDetails(req.Items),
			"enabled_payments": []string{"gopay"},
		}
		applyMidtransFinishCallback(payload, req.ReturnURL)
		return p.doSnapCharge(ctx, req.OrderID, "ewallet", payload)
	default:
		return ChargeResponse{}, fmt.Errorf("payment method tidak didukung: %s", req.PaymentMethodType)
	}
}

func (p *midtransProvider) ChargeSavedCard(ctx context.Context, req SavedCardChargeRequest) (ChargeResponse, error) {
	payload := map[string]any{
		"payment_type": "credit_card",
		"credit_card": map[string]any{
			"token_id":       req.SavedTokenID,
			"authentication": false,
		},
		"transaction_details": map[string]any{
			"order_id":     req.OrderID,
			"gross_amount": req.Amount,
		},
		"customer_details": p.customerDetails(req.Customer),
		"item_details":     p.itemDetails(req.Items),
	}
	return p.doCoreCharge(ctx, payload)
}

func (p *midtransProvider) CheckTransaction(ctx context.Context, orderID string) (ChargeResponse, error) {
	orderID = url.PathEscape(strings.TrimSpace(orderID))
	body, err := p.doJSON(ctx, http.MethodGet, fmt.Sprintf("%s/v2/%s/status", p.apiBaseURL, orderID), nil)
	if err != nil {
		return ChargeResponse{}, err
	}
	var response midtransResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return ChargeResponse{}, fmt.Errorf("decode midtrans status response: %w", err)
	}
	return p.normalizeResponse(response, body, response.PaymentType), nil
}

func (p *midtransProvider) ParseWebhook(payload []byte) (StatusNotification, error) {
	var response midtransResponse
	if err := json.Unmarshal(payload, &response); err != nil {
		return StatusNotification{}, fmt.Errorf("decode midtrans webhook: %w", err)
	}
	normalized := p.normalizeResponse(response, payload, response.PaymentType)
	return StatusNotification{
		Provider:          ProviderMidtrans,
		ExternalID:        strings.TrimSpace(response.OrderID),
		EventType:         strings.TrimSpace(response.TransactionStatus),
		StatusCode:        strings.TrimSpace(response.StatusCode),
		GrossAmount:       strings.TrimSpace(response.GrossAmount),
		TransactionStatus: strings.TrimSpace(response.TransactionStatus),
		FraudStatus:       strings.TrimSpace(response.FraudStatus),
		PaymentMethodType: normalizePaymentMethod(response.PaymentType),
		SignatureKey:      strings.TrimSpace(response.SignatureKey),
		SavedTokenID:      strings.TrimSpace(response.SavedTokenID),
		CardBrand:         strings.TrimSpace(response.CardType),
		MaskedCard:        strings.TrimSpace(response.MaskedCard),
		RedirectURL:       normalized.RedirectURL,
		CheckoutURL:       normalized.CheckoutURL,
		ExpiresAt:         normalized.ExpiresAt,
		PaidAt:            normalized.PaidAt,
		Raw:               payload,
	}, nil
}

func (p *midtransProvider) VerifyWebhookSignature(notification StatusNotification) error {
	expected := MidtransSignature(notification.ExternalID, notification.StatusCode, notification.GrossAmount, p.serverKey)
	if !strings.EqualFold(expected, strings.TrimSpace(notification.SignatureKey)) {
		return fmt.Errorf("signature midtrans tidak valid")
	}
	return nil
}

func (p *midtransProvider) doCoreCharge(ctx context.Context, payload map[string]any) (ChargeResponse, error) {
	body, err := p.doJSON(ctx, http.MethodPost, p.apiBaseURL+"/v2/charge", payload)
	if err != nil {
		return ChargeResponse{}, err
	}
	var response midtransResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return ChargeResponse{}, fmt.Errorf("decode midtrans charge response: %w", err)
	}
	return p.normalizeResponse(response, body, normalizePaymentMethod(response.PaymentType)), nil
}

func (p *midtransProvider) doSnapCharge(ctx context.Context, orderID, paymentMethodType string, payload map[string]any) (ChargeResponse, error) {
	body, err := p.doJSON(ctx, http.MethodPost, p.snapURL, payload)
	if err != nil {
		return ChargeResponse{}, err
	}
	var response midtransSnapResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return ChargeResponse{}, fmt.Errorf("decode midtrans snap response: %w", err)
	}
	return ChargeResponse{
		Provider:          ProviderMidtrans,
		OrderID:           orderID,
		StatusCode:        "201",
		StatusMessage:     "Snap transaction created",
		TransactionStatus: "pending",
		PaymentMethodType: paymentMethodType,
		CheckoutURL:       strings.TrimSpace(response.RedirectURL),
		RedirectURL:       strings.TrimSpace(response.RedirectURL),
		Raw:               body,
	}, nil
}

func (p *midtransProvider) doJSON(ctx context.Context, method, endpoint string, payload any) ([]byte, error) {
	var bodyReader io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("marshal midtrans payload: %w", err)
		}
		bodyReader = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create midtrans request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(p.serverKey+":")))

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send midtrans request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read midtrans response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("midtrans request failed: %s", strings.TrimSpace(string(body)))
	}
	return body, nil
}

func (p *midtransProvider) normalizeResponse(response midtransResponse, raw []byte, paymentMethodType string) ChargeResponse {
	expiresAt := parseMidtransTime(response.ExpiryTime)
	paidAt := parseMidtransTime(response.SettlementTime)
	if paidAt == nil {
		paidAt = parseMidtransTime(response.TransactionTime)
	}
	redirectURL := strings.TrimSpace(response.RedirectURL)
	if redirectURL == "" {
		for _, action := range response.Actions {
			if strings.TrimSpace(action.URL) != "" {
				redirectURL = strings.TrimSpace(action.URL)
				break
			}
		}
	}
	return ChargeResponse{
		Provider:          ProviderMidtrans,
		OrderID:           strings.TrimSpace(response.OrderID),
		StatusCode:        strings.TrimSpace(response.StatusCode),
		StatusMessage:     strings.TrimSpace(response.StatusMessage),
		TransactionStatus: strings.TrimSpace(response.TransactionStatus),
		FraudStatus:       strings.TrimSpace(response.FraudStatus),
		PaymentMethodType: paymentMethodType,
		CheckoutURL:       redirectURL,
		RedirectURL:       redirectURL,
		ExpiresAt:         expiresAt,
		PaidAt:            paidAt,
		SavedTokenID:      strings.TrimSpace(response.SavedTokenID),
		CardBrand:         strings.TrimSpace(response.CardType),
		MaskedCard:        strings.TrimSpace(response.MaskedCard),
		Raw:               raw,
	}
}

func applyMidtransFinishCallback(payload map[string]any, returnURL string) {
	returnURL = strings.TrimSpace(returnURL)
	if returnURL == "" {
		return
	}
	payload["callbacks"] = map[string]any{
		"finish": returnURL,
	}
}

func (p *midtransProvider) customerDetails(customer Customer) map[string]any {
	firstName := customer.FullName
	lastName := ""
	if cut := strings.Index(strings.TrimSpace(customer.FullName), " "); cut > 0 {
		firstName = strings.TrimSpace(customer.FullName[:cut])
		lastName = strings.TrimSpace(customer.FullName[cut+1:])
	}
	return map[string]any{
		"first_name": firstName,
		"last_name":  lastName,
		"email":      strings.TrimSpace(customer.Email),
		"phone":      trimPhone(customer.Phone),
	}
}

func (p *midtransProvider) itemDetails(items []Item) []map[string]any {
	if len(items) == 0 {
		return []map[string]any{}
	}
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]any{
			"id":       item.ID,
			"name":     item.Name,
			"price":    item.Price,
			"quantity": item.Quantity,
		})
	}
	return result
}

func parseMidtransTime(value string) *time.Time {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02 15:04:05 -0700",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			utc := parsed.UTC()
			return &utc
		}
	}
	return nil
}

func normalizePaymentMethod(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "credit_card":
		return "card"
	case "bank_transfer":
		return "bank"
	case "gopay", "shopeepay", "qris":
		return "ewallet"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}
