package billing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"moodlepilot/backend/internal/store"
)

const TaskTypeReconcileBilling = "billing:reconcile"

type Handler struct {
	Store     *store.Store
	Provider  Provider
	Finalizer Finalizer
}

func NewReconcileBillingTask() *asynq.Task {
	return asynq.NewTask(TaskTypeReconcileBilling, nil)
}

func (h Handler) HandleReconcileBillingTask(ctx context.Context, _ *asynq.Task) error {
	now := time.Now().UTC()
	if _, err := h.Store.ExpireStaleSiteCheckoutOrders(ctx, now); err != nil {
		return fmt.Errorf("expire stale site checkout orders: %w", err)
	}
	if _, err := h.Store.CompleteProvisionedSiteCheckoutOrders(ctx, now); err != nil {
		return fmt.Errorf("complete provisioned site checkout orders: %w", err)
	}
	if _, err := h.Store.ExpireStalePendingInvoices(ctx, now); err != nil {
		return fmt.Errorf("expire stale pending invoices: %w", err)
	}

	pendingInvoices, err := h.Store.ListPendingInvoiceCandidates(ctx, 30*time.Second)
	if err != nil {
		return fmt.Errorf("list pending invoices: %w", err)
	}
	for _, candidate := range pendingInvoices {
		if err := h.reconcilePendingInvoice(ctx, candidate); err != nil {
			log.Printf("billing: reconcile pending invoice failed invoice=%s: %v", candidate.Invoice.ID, err)
		}
	}

	dueSubscriptions, err := h.Store.ListDueSubscriptions(ctx, now)
	if err != nil {
		return fmt.Errorf("list due subscriptions: %w", err)
	}
	for _, candidate := range dueSubscriptions {
		if candidate.Subscription.CollectionMethod == "manual_invoice" || candidate.PaymentMethod.ID == uuid.Nil || !candidate.PaymentMethod.Reusable {
			if err := h.issueManualRenewalInvoice(ctx, candidate); err != nil {
				log.Printf("billing: issue manual renewal failed subscription=%s: %v", candidate.Subscription.ID, err)
			}
			continue
		}
		if err := h.chargeDueSubscription(ctx, candidate); err != nil {
			log.Printf("billing: reconcile subscription failed subscription=%s: %v", candidate.Subscription.ID, err)
		}
	}
	return nil
}

func (h Handler) reconcilePendingInvoice(ctx context.Context, candidate store.PendingInvoiceCandidate) error {
	response, err := h.Provider.CheckTransaction(ctx, candidate.Invoice.ExternalID)
	if err != nil {
		return err
	}

	invoiceStatus, attemptStatus := paymentStateFromChargeResponse(response)
	invoice, _, err := h.Store.UpdateInvoicePaymentState(ctx, store.UpdateInvoicePaymentStateParams{
		InvoiceID:            candidate.Invoice.ID,
		Status:               invoiceStatus,
		CheckoutURL:          response.CheckoutURL,
		RedirectURL:          response.RedirectURL,
		PaymentMethodType:    firstNonEmpty(strings.TrimSpace(response.PaymentMethodType), candidate.Invoice.PaymentMethodType),
		AttemptStatus:        attemptStatus,
		AttemptRedirectURL:   response.RedirectURL,
		AttemptFailureReason: response.StatusMessage,
		AttemptRawResponse:   response.Raw,
		ExpiresAt:            response.ExpiresAt,
		PaidAt:               response.PaidAt,
		FailedAt:             failedAtForInvoiceStatus(invoiceStatus),
		CanceledAt:           canceledAtForInvoiceStatus(invoiceStatus),
	})
	if err != nil {
		return err
	}

	switch invoice.Status {
	case "paid":
		return h.Finalizer.FinalizePaidInvoice(ctx, invoice, response)
	case "failed", "expired", "canceled":
		if invoice.SubscriptionID != nil {
			if _, err := h.Store.MarkSubscriptionPastDue(ctx, *invoice.SubscriptionID, time.Now().UTC(), response.StatusMessage); err != nil && !errors.Is(err, store.ErrNotFound) {
				return err
			}
		}
	}

	return nil
}

func (h Handler) chargeDueSubscription(ctx context.Context, candidate store.DueSubscriptionCandidate) error {
	invoiceID := uuidString()
	now := time.Now().UTC()

	invoice, _, err := h.Store.CreateInvoiceWithAttempt(ctx, store.CreateInvoiceWithAttemptParams{
		OwnerUserID:        candidate.Subscription.OwnerUserID,
		CustomerID:         candidate.Subscription.CustomerID,
		SiteID:             candidate.Subscription.SiteID,
		SiteName:           candidate.Site.Name,
		SiteSubdomain:      candidate.Site.Subdomain,
		SubscriptionID:     &candidate.Subscription.ID,
		Provider:           h.Provider.Name(),
		ExternalID:         "renewal-" + invoiceID,
		Number:             fmt.Sprintf("INV-%s-%s", now.Format("20060102"), stringsUpper(invoiceID[:8])),
		Description:        fmt.Sprintf("Perpanjangan paket %s", candidate.Subscription.CurrentPlanCode),
		Status:             "pending",
		Currency:           candidate.Subscription.Currency,
		BillingCycle:       candidate.Subscription.BillingCycle,
		FromPlanCode:       candidate.Subscription.CurrentPlanCode,
		ToPlanCode:         candidate.Subscription.CurrentPlanCode,
		PaymentMethodType:  "card",
		AmountSubtotal:     candidate.Subscription.AmountTotal,
		AmountTax:          0,
		AmountTotal:        candidate.Subscription.AmountTotal,
		ExpiresAt:          ptrTime(now.Add(24 * time.Hour)),
		ItemType:           "renewal",
		ItemName:           candidate.Subscription.CurrentPlanCode,
		ItemDescription:    fmt.Sprintf("Perpanjangan otomatis %s", candidate.Site.Name),
		ItemQuantity:       1,
		ItemUnitAmount:     candidate.Subscription.AmountTotal,
		ItemTotalAmount:    candidate.Subscription.AmountTotal,
		ItemMetadata:       json.RawMessage(`{}`),
		AttemptStatus:      "created",
		AttemptRawResponse: json.RawMessage(`{}`),
		AttemptExpiresAt:   ptrTime(now.Add(24 * time.Hour)),
	})
	if err != nil {
		return err
	}

	response, err := h.Provider.ChargeSavedCard(ctx, SavedCardChargeRequest{
		OrderID:      invoice.ExternalID,
		Amount:       invoice.AmountTotal,
		Currency:     invoice.Currency,
		SavedTokenID: candidate.PaymentMethod.ProviderToken,
		Customer: Customer{
			ReferenceID:  candidate.Customer.UserID.String(),
			FullName:     candidate.Customer.FullName,
			Email:        candidate.Customer.Email,
			Phone:        candidate.Customer.Phone,
			Organization: candidate.Customer.Organization,
		},
		Items: []Item{
			{
				ID:          candidate.Subscription.CurrentPlanCode,
				Name:        candidate.Subscription.CurrentPlanCode,
				Description: fmt.Sprintf("Perpanjangan otomatis %s", candidate.Site.Name),
				Quantity:    1,
				Price:       invoice.AmountTotal,
			},
		},
	})
	if err != nil {
		_, _, _ = h.Store.UpdateInvoicePaymentState(ctx, store.UpdateInvoicePaymentStateParams{
			InvoiceID:            invoice.ID,
			Status:               "failed",
			AttemptStatus:        "failed",
			AttemptFailureReason: err.Error(),
			AttemptRawResponse:   json.RawMessage(`{}`),
			FailedAt:             ptrTime(time.Now().UTC()),
		})
		_, _ = h.Store.MarkSubscriptionPastDue(ctx, candidate.Subscription.ID, time.Now().UTC(), err.Error())
		_, _ = h.Store.CreateNotification(ctx, store.CreateNotificationParams{
			UserID:    candidate.Subscription.OwnerUserID,
			Type:      "warning",
			Category:  "billing",
			Title:     "Pembayaran berulang gagal",
			Message:   fmt.Sprintf("Perpanjangan otomatis untuk %s gagal diproses.", candidate.Site.Name),
			ActionURL: "/tagihan",
		})
		return err
	}

	invoiceStatus := "pending"
	attemptStatus := "pending"
	if IsPaidStatus(response.TransactionStatus, response.FraudStatus) {
		invoiceStatus = "paid"
		attemptStatus = "paid"
	} else if IsFailureStatus(response.TransactionStatus) {
		invoiceStatus, attemptStatus = paymentStateFromChargeResponse(response)
	}

	invoice, _, err = h.Store.UpdateInvoicePaymentState(ctx, store.UpdateInvoicePaymentStateParams{
		InvoiceID:            invoice.ID,
		Status:               invoiceStatus,
		CheckoutURL:          response.CheckoutURL,
		RedirectURL:          response.RedirectURL,
		PaymentMethodType:    "card",
		AttemptStatus:        attemptStatus,
		AttemptRedirectURL:   response.RedirectURL,
		AttemptFailureReason: response.StatusMessage,
		AttemptRawResponse:   response.Raw,
		ExpiresAt:            response.ExpiresAt,
		PaidAt:               response.PaidAt,
		FailedAt:             failedTime(invoiceStatus),
		CanceledAt:           canceledAtForInvoiceStatus(invoiceStatus),
	})
	if err != nil {
		return err
	}

	if invoice.Status == "paid" {
		return h.Finalizer.FinalizePaidInvoice(ctx, invoice, response)
	}

	if invoice.Status == "failed" || invoice.Status == "expired" || invoice.Status == "canceled" {
		if _, err := h.Store.MarkSubscriptionPastDue(ctx, candidate.Subscription.ID, time.Now().UTC(), response.StatusMessage); err != nil {
			return err
		}
		_, _ = h.Store.CreateNotification(ctx, store.CreateNotificationParams{
			UserID:    candidate.Subscription.OwnerUserID,
			Type:      "warning",
			Category:  "billing",
			Title:     "Pembayaran berulang gagal",
			Message:   fmt.Sprintf("Perpanjangan otomatis untuk %s gagal diproses.", candidate.Site.Name),
			ActionURL: "/tagihan",
		})
	}

	return nil
}

func (h Handler) issueManualRenewalInvoice(ctx context.Context, candidate store.DueSubscriptionCandidate) error {
	if existing, err := h.Store.FindPendingInvoiceBySubscriptionID(ctx, candidate.Subscription.ID); err == nil {
		_, _ = h.Store.MarkSubscriptionPastDue(ctx, candidate.Subscription.ID, time.Now().UTC(), "Menunggu pembayaran manual")
		_, _ = h.Store.CreateNotification(ctx, store.CreateNotificationParams{
			UserID:    candidate.Subscription.OwnerUserID,
			Type:      "info",
			Category:  "billing",
			Title:     "Invoice perpanjangan tersedia",
			Message:   fmt.Sprintf("Perpanjangan untuk %s menunggu pembayaran manual.", candidate.Site.Name),
			ActionURL: "/tagihan/" + existing.ID.String(),
		})
		return nil
	} else if !errors.Is(err, store.ErrNotFound) {
		return err
	}

	now := time.Now().UTC()
	invoiceID := uuidString()
	invoice, _, err := h.Store.CreateInvoiceWithAttempt(ctx, store.CreateInvoiceWithAttemptParams{
		OwnerUserID:        candidate.Subscription.OwnerUserID,
		CustomerID:         candidate.Subscription.CustomerID,
		SiteID:             candidate.Subscription.SiteID,
		SiteName:           candidate.Site.Name,
		SiteSubdomain:      candidate.Site.Subdomain,
		SubscriptionID:     &candidate.Subscription.ID,
		Provider:           h.Provider.Name(),
		ExternalID:         "renewal-" + invoiceID,
		Number:             fmt.Sprintf("INV-%s-%s", now.Format("20060102"), stringsUpper(invoiceID[:8])),
		Description:        fmt.Sprintf("Perpanjangan manual paket %s", candidate.Subscription.CurrentPlanCode),
		Status:             "pending",
		Currency:           candidate.Subscription.Currency,
		BillingCycle:       candidate.Subscription.BillingCycle,
		FromPlanCode:       candidate.Subscription.CurrentPlanCode,
		ToPlanCode:         candidate.Subscription.CurrentPlanCode,
		PaymentMethodType:  "bank",
		AmountSubtotal:     candidate.Subscription.AmountTotal,
		AmountTax:          0,
		AmountTotal:        candidate.Subscription.AmountTotal,
		ExpiresAt:          ptrTime(now.Add(24 * time.Hour)),
		ItemType:           "renewal",
		ItemName:           candidate.Subscription.CurrentPlanCode,
		ItemDescription:    fmt.Sprintf("Perpanjangan manual %s", candidate.Site.Name),
		ItemQuantity:       1,
		ItemUnitAmount:     candidate.Subscription.AmountTotal,
		ItemTotalAmount:    candidate.Subscription.AmountTotal,
		ItemMetadata:       json.RawMessage(`{}`),
		AttemptStatus:      "created",
		AttemptRawResponse: json.RawMessage(`{}`),
		AttemptExpiresAt:   ptrTime(now.Add(24 * time.Hour)),
	})
	if err != nil {
		return err
	}

	response, err := h.Provider.CreateCheckout(ctx, ChargeRequest{
		OrderID:           invoice.ExternalID,
		Amount:            invoice.AmountTotal,
		Currency:          invoice.Currency,
		PaymentMethodType: invoice.PaymentMethodType,
		Customer: Customer{
			ReferenceID:  candidate.Customer.UserID.String(),
			FullName:     candidate.Customer.FullName,
			Email:        candidate.Customer.Email,
			Phone:        candidate.Customer.Phone,
			Organization: candidate.Customer.Organization,
		},
		Items: []Item{
			{
				ID:          candidate.Subscription.CurrentPlanCode,
				Name:        candidate.Subscription.CurrentPlanCode,
				Description: fmt.Sprintf("Perpanjangan manual %s", candidate.Site.Name),
				Quantity:    1,
				Price:       invoice.AmountTotal,
			},
		},
	})
	if err != nil {
		_, _, _ = h.Store.UpdateInvoicePaymentState(ctx, store.UpdateInvoicePaymentStateParams{
			InvoiceID:            invoice.ID,
			Status:               "failed",
			AttemptStatus:        "failed",
			AttemptFailureReason: err.Error(),
			AttemptRawResponse:   json.RawMessage(`{}`),
			FailedAt:             ptrTime(time.Now().UTC()),
		})
		_, _ = h.Store.MarkSubscriptionPastDue(ctx, candidate.Subscription.ID, time.Now().UTC(), err.Error())
		return err
	}

	invoiceStatus, attemptStatus := paymentStateFromChargeResponse(response)
	invoice, _, err = h.Store.UpdateInvoicePaymentState(ctx, store.UpdateInvoicePaymentStateParams{
		InvoiceID:            invoice.ID,
		Status:               invoiceStatus,
		CheckoutURL:          response.CheckoutURL,
		RedirectURL:          response.RedirectURL,
		PaymentMethodType:    invoice.PaymentMethodType,
		AttemptStatus:        attemptStatus,
		AttemptRedirectURL:   response.RedirectURL,
		AttemptFailureReason: response.StatusMessage,
		AttemptRawResponse:   response.Raw,
		ExpiresAt:            response.ExpiresAt,
		PaidAt:               response.PaidAt,
		FailedAt:             failedAtForInvoiceStatus(invoiceStatus),
		CanceledAt:           canceledAtForInvoiceStatus(invoiceStatus),
	})
	if err != nil {
		return err
	}

	if invoice.Status == "paid" {
		return h.Finalizer.FinalizePaidInvoice(ctx, invoice, response)
	}

	_, _ = h.Store.MarkSubscriptionPastDue(ctx, candidate.Subscription.ID, time.Now().UTC(), "Menunggu pembayaran manual")
	_, _ = h.Store.CreateNotification(ctx, store.CreateNotificationParams{
		UserID:    candidate.Subscription.OwnerUserID,
		Type:      "info",
		Category:  "billing",
		Title:     "Invoice perpanjangan tersedia",
		Message:   fmt.Sprintf("Perpanjangan untuk %s menunggu pembayaran manual.", candidate.Site.Name),
		ActionURL: "/tagihan/" + invoice.ID.String(),
	})

	return nil
}

func failedTime(status string) *time.Time {
	if status != "failed" {
		return nil
	}
	return ptrTime(time.Now().UTC())
}

func paymentStateFromChargeResponse(response ChargeResponse) (string, string) {
	if IsPaidStatus(response.TransactionStatus, response.FraudStatus) {
		return "paid", "paid"
	}
	if IsFailureStatus(response.TransactionStatus) {
		switch strings.ToLower(strings.TrimSpace(response.TransactionStatus)) {
		case "cancel":
			return "canceled", "canceled"
		case "expire":
			return "expired", "expired"
		default:
			return "failed", "failed"
		}
	}
	return "pending", "pending"
}

func failedAtForInvoiceStatus(status string) *time.Time {
	switch status {
	case "failed", "expired":
		return ptrTime(time.Now().UTC())
	default:
		return nil
	}
}

func canceledAtForInvoiceStatus(status string) *time.Time {
	if status != "canceled" {
		return nil
	}
	return ptrTime(time.Now().UTC())
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func uuidString() string {
	return uuid.NewString()
}

func stringsUpper(value string) string {
	return strings.ToUpper(value)
}
