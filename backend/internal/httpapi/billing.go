package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"moodlepilot/backend/internal/billing"
	"moodlepilot/backend/internal/store"
)

type billingOverviewResponse struct {
	Overview store.BillingOverview `json:"overview"`
}

type billingSiteSnapshotResponse struct {
	SiteID        *uuid.UUID `json:"site_id,omitempty"`
	SiteName      string     `json:"site_name"`
	SiteSubdomain string     `json:"site_subdomain"`
}

type billingInvoiceResponse struct {
	Invoice       store.Invoice                 `json:"invoice"`
	Items         []store.InvoiceItem           `json:"items"`
	LatestAttempt *store.PaymentAttempt         `json:"latest_attempt,omitempty"`
	SiteSnapshot  billingSiteSnapshotResponse   `json:"site_snapshot"`
	CheckoutOrder *store.SiteCheckoutOrder      `json:"checkout_order,omitempty"`
}

type billingCheckoutResponse struct {
	Invoice  store.Invoice        `json:"invoice"`
	Attempt  store.PaymentAttempt `json:"attempt"`
	Message  string               `json:"message"`
	Provider billing.PublicConfig `json:"provider"`
}

func (s *Server) lookupBillingInvoiceForOwner(ctx context.Context, ownerUserID uuid.UUID, invoiceKey string) (store.Invoice, error) {
	invoiceKey = strings.TrimSpace(invoiceKey)
	if invoiceKey == "" {
		return store.Invoice{}, fmt.Errorf("%w: invoice key kosong", store.ErrNotFound)
	}
	if invoiceID, err := uuid.Parse(invoiceKey); err == nil {
		return s.store.GetInvoiceByIDForOwner(ctx, ownerUserID, invoiceID)
	}
	return s.store.GetInvoiceByExternalIDForOwner(ctx, ownerUserID, invoiceKey)
}

func (s *Server) buildBillingInvoiceDetailResponse(ctx context.Context, invoice store.Invoice) (billingInvoiceResponse, error) {
	items, err := s.store.ListInvoiceItemsByInvoiceID(ctx, invoice.ID)
	if err != nil {
		return billingInvoiceResponse{}, err
	}

	var latestAttempt *store.PaymentAttempt
	attempt, err := s.store.GetLatestPaymentAttemptByInvoiceID(ctx, invoice.ID)
	if err == nil {
		latestAttempt = &attempt
	} else if !errors.Is(err, store.ErrNotFound) {
		return billingInvoiceResponse{}, err
	}

	var checkoutOrder *store.SiteCheckoutOrder
	order, err := s.store.GetSiteCheckoutOrderByInvoiceID(ctx, invoice.ID)
	if err == nil {
		checkoutOrder = &order
	} else if !errors.Is(err, store.ErrNotFound) {
		return billingInvoiceResponse{}, err
	}

	return billingInvoiceResponse{
		Invoice:       invoice,
		Items:         items,
		LatestAttempt: latestAttempt,
		SiteSnapshot: billingSiteSnapshotResponse{
			SiteID:        invoice.SiteID,
			SiteName:      invoice.SiteName,
			SiteSubdomain: invoice.SiteSubdomain,
		},
		CheckoutOrder: checkoutOrder,
	}, nil
}

func buildChargeItemsFromInvoiceItems(items []store.InvoiceItem, fallbackDescription string) []billing.Item {
	if len(items) == 0 {
		return []billing.Item{{
			ID:          "invoice",
			Name:        "Invoice",
			Description: strings.TrimSpace(fallbackDescription),
			Quantity:    1,
			Price:       0,
		}}
	}

	chargeItems := make([]billing.Item, 0, len(items))
	for _, item := range items {
		quantity := item.Quantity
		if quantity <= 0 {
			quantity = 1
		}
		price := item.UnitAmount
		if price <= 0 && quantity > 0 {
			price = item.TotalAmount / int64(quantity)
		}
		chargeItems = append(chargeItems, billing.Item{
			ID:          item.ID.String(),
			Name:        item.Name,
			Description: item.Description,
			Quantity:    quantity,
			Price:       price,
		})
	}
	return chargeItems
}

func (s *Server) createProviderCheckoutForInvoice(ctx context.Context, invoice store.Invoice, paymentMethodType string, customer billing.Customer, items []billing.Item, cardTokenID string, returnURL string) (store.Invoice, store.PaymentAttempt, error) {
	paymentMethodType = normalizePaymentMethodType(firstNonEmptyString(paymentMethodType, invoice.PaymentMethodType))
	cardTokenID = strings.TrimSpace(cardTokenID)
	if paymentMethodType == "card" && s.billing.Name() == billing.ProviderMidtrans && cardTokenID == "" {
		return invoice, store.PaymentAttempt{}, fmt.Errorf("token kartu belum tersedia")
	}

	providerResponse, providerErr := s.billing.CreateCheckout(ctx, billing.ChargeRequest{
		OrderID:           invoice.ExternalID,
		Amount:            invoice.AmountTotal,
		Currency:          invoice.Currency,
		PaymentMethodType: paymentMethodType,
		CardTokenID:       cardTokenID,
		SaveCard:          paymentMethodType == "card",
		Customer:          customer,
		Items:             items,
		ReturnURL:         returnURL,
	})
	if providerErr != nil {
		updatedInvoice, updatedAttempt, _ := s.store.UpdateInvoicePaymentState(ctx, store.UpdateInvoicePaymentStateParams{
			InvoiceID:            invoice.ID,
			Status:               "failed",
			AttemptStatus:        "failed",
			AttemptFailureReason: providerErr.Error(),
			FailedAt:             ptrTime(time.Now().UTC()),
			AttemptRawResponse:   json.RawMessage(`{}`),
		})
		return updatedInvoice, updatedAttempt, providerErr
	}

	invoiceStatus, attemptStatus := paymentStateFromProvider(providerResponse)
	updatedInvoice, updatedAttempt, err := s.store.UpdateInvoicePaymentState(ctx, store.UpdateInvoicePaymentStateParams{
		InvoiceID:            invoice.ID,
		Status:               invoiceStatus,
		CheckoutURL:          providerResponse.CheckoutURL,
		RedirectURL:          providerResponse.RedirectURL,
		PaymentMethodType:    paymentMethodType,
		AttemptStatus:        attemptStatus,
		AttemptRedirectURL:   providerResponse.RedirectURL,
		AttemptFailureReason: providerResponse.StatusMessage,
		AttemptRawResponse:   providerResponse.Raw,
		ExpiresAt:            providerResponse.ExpiresAt,
		PaidAt:               providerResponse.PaidAt,
		FailedAt:             failedAtForStatus(invoiceStatus),
		CanceledAt:           canceledAtForStatus(invoiceStatus),
	})
	if err != nil {
		return store.Invoice{}, store.PaymentAttempt{}, err
	}

	if updatedInvoice.Status == "paid" {
		if err := s.finalizePaidInvoice(ctx, updatedInvoice, providerResponse); err != nil {
			return store.Invoice{}, store.PaymentAttempt{}, err
		}
	}

	return updatedInvoice, updatedAttempt, nil
}

func (s *Server) handleGetBillingConfig(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.billing.PublicConfig())
}

func (s *Server) handleGetBillingOverview(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())

	sites, err := s.store.ListSitesByOwner(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	changes, err := s.store.ListSitePlanChangesByOwner(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	invoices, err := s.store.ListInvoicesByOwner(r.Context(), user.ID, 20)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	paymentMethods, err := s.store.ListBillingPaymentMethodsByOwner(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	subscriptions, err := s.store.ListSubscriptionsByOwner(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, billingOverviewResponse{
		Overview: store.BillingOverview{
			Sites:          sites,
			Changes:        changes,
			Invoices:       invoices,
			PaymentMethods: paymentMethods,
			Subscriptions:  subscriptions,
		},
	})
}

func (s *Server) handleGetBillingInvoice(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	invoiceKey := strings.TrimSpace(chi.URLParam(r, "invoiceID"))
	if invoiceKey == "" {
		writeError(w, http.StatusBadRequest, "Invoice ID tidak valid")
		return
	}

	invoice, err := s.lookupBillingInvoiceForOwner(r.Context(), user.ID, invoiceKey)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Invoice tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response, err := s.buildBillingInvoiceDetailResponse(r.Context(), invoice)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleCreateBillingCheckout(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())

	var req struct {
		SiteID            string `json:"site_id"`
		TargetPlanCode    string `json:"target_plan_code"`
		BillingCycle      string `json:"billing_cycle"`
		PaymentMethodType string `json:"payment_method_type"`
		FullName          string `json:"full_name"`
		Email             string `json:"email"`
		Phone             string `json:"phone"`
		Organization      string `json:"organization"`
		CardTokenID       string `json:"card_token_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	siteID, err := uuid.Parse(strings.TrimSpace(req.SiteID))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Site ID tidak valid")
		return
	}
	req.TargetPlanCode = strings.TrimSpace(req.TargetPlanCode)
	req.BillingCycle = normalizeBillingCycle(req.BillingCycle)
	req.PaymentMethodType = normalizePaymentMethodType(req.PaymentMethodType)

	if req.TargetPlanCode == "" {
		writeError(w, http.StatusBadRequest, "Paket tujuan wajib diisi")
		return
	}
	if req.PaymentMethodType == "" {
		writeError(w, http.StatusBadRequest, "Metode pembayaran wajib diisi")
		return
	}
	if req.PaymentMethodType == "card" && s.billing.Name() == billing.ProviderMidtrans && strings.TrimSpace(req.CardTokenID) == "" {
		writeError(w, http.StatusBadRequest, "Token kartu belum tersedia")
		return
	}

	currentSite, targetPlan, err := s.validatePlanChangeRequest(r, user.ID, siteID, req.TargetPlanCode)
	if err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, store.ErrNotFound):
			status = http.StatusNotFound
		case errors.Is(err, store.ErrConflict):
			status = http.StatusConflict
		}
		writeError(w, status, err.Error())
		return
	}

	amountSubtotal, err := planAmountForCycle(targetPlan, req.BillingCycle)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if amountSubtotal <= 0 {
		updatedSite, updatedUsage, err := s.applySitePlanChange(r.Context(), user.ID, currentSite, targetPlan)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if _, auditErr := s.store.CreateSitePlanChange(r.Context(), store.CreateSitePlanChangeParams{
			SiteID:        &currentSite.ID,
			SiteName:      currentSite.Name,
			SiteSubdomain: currentSite.Subdomain,
			OwnerUserID:   user.ID,
			FromPlanCode:  currentSite.PlanCode,
			ToPlanCode:    targetPlan.Code,
			Status:        "applied",
			AppliedAt:     time.Now().UTC(),
		}); auditErr != nil {
			log.Printf("billing: create zero-amount plan change audit failed site=%s: %v", currentSite.Subdomain, auditErr)
		}
		writeJSON(w, http.StatusOK, sitePlanChangeResponse{
			Site:    updatedSite,
			Usage:   updatedUsage,
			Message: fmt.Sprintf("Paket situs berhasil di-upgrade ke %s", targetPlan.Name),
		})
		return
	}

	amountTax := billingTax(amountSubtotal)
	amountTotal := amountSubtotal + amountTax
	fullName := strings.TrimSpace(req.FullName)
	if fullName == "" {
		fullName = strings.TrimSpace(user.Name)
	}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		email = strings.TrimSpace(user.Email)
	}
	phone := strings.TrimSpace(req.Phone)
	org := strings.TrimSpace(req.Organization)
	if org == "" {
		org = strings.TrimSpace(user.Organization)
	}

	customer, err := s.store.UpsertBillingCustomer(r.Context(), store.UpsertBillingCustomerParams{
		UserID:             user.ID,
		Provider:           s.billing.Name(),
		ProviderCustomerID: user.ID.String(),
		FullName:           fullName,
		Email:              email,
		Phone:              phone,
		Organization:       org,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	invoiceID := uuid.New()
	orderID := buildBillingOrderID(invoiceID)
	invoiceNumber := buildInvoiceNumber(invoiceID)
	returnURL := buildCheckoutReturnURL(s.frontendOriginForRequest(r), invoiceID)

	invoice, attempt, err := s.store.CreateInvoiceWithAttempt(r.Context(), store.CreateInvoiceWithAttemptParams{
		OwnerUserID:        user.ID,
		CustomerID:         customer.ID,
		SiteID:             &currentSite.ID,
		SiteName:           currentSite.Name,
		SiteSubdomain:      currentSite.Subdomain,
		Provider:           s.billing.Name(),
		ExternalID:         orderID,
		Number:             invoiceNumber,
		Description:        fmt.Sprintf("Upgrade %s ke %s", currentSite.Name, targetPlan.Name),
		Status:             "pending",
		Currency:           "IDR",
		BillingCycle:       req.BillingCycle,
		FromPlanCode:       currentSite.PlanCode,
		ToPlanCode:         targetPlan.Code,
		PaymentMethodType:  req.PaymentMethodType,
		AmountSubtotal:     amountSubtotal,
		AmountTax:          amountTax,
		AmountTotal:        amountTotal,
		ExpiresAt:          ptrTime(time.Now().UTC().Add(24 * time.Hour)),
		ItemType:           "plan",
		ItemName:           targetPlan.Name,
		ItemDescription:    fmt.Sprintf("Upgrade paket %s per-site", targetPlan.Name),
		ItemQuantity:       1,
		ItemUnitAmount:     amountTotal,
		ItemTotalAmount:    amountTotal,
		ItemMetadata:       json.RawMessage(`{}`),
		AttemptStatus:      "created",
		AttemptRawResponse: json.RawMessage(`{}`),
		AttemptExpiresAt:   ptrTime(time.Now().UTC().Add(24 * time.Hour)),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	invoice, attempt, err = s.createProviderCheckoutForInvoice(r.Context(), invoice, req.PaymentMethodType, billing.Customer{
		ReferenceID:  user.ID.String(),
		FullName:     fullName,
		Email:        email,
		Phone:        phone,
		Organization: org,
	}, []billing.Item{
		{
			ID:          targetPlan.Code,
			Name:        targetPlan.Name,
			Description: fmt.Sprintf("Upgrade paket %s", targetPlan.Name),
			Quantity:    1,
			Price:       amountTotal,
		},
	}, req.CardTokenID, returnURL)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, billingCheckoutResponse{
		Invoice:  invoice,
		Attempt:  attempt,
		Message:  fmt.Sprintf("Checkout %s berhasil dibuat", invoice.Number),
		Provider: s.billing.PublicConfig(),
	})
}

func (s *Server) handleCreateSiteCheckout(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())

	var req struct {
		SiteName          string `json:"site_name"`
		Subdomain         string `json:"subdomain"`
		PlanCode          string `json:"plan_code"`
		BillingCycle      string `json:"billing_cycle"`
		Region            string `json:"region"`
		AdminName         string `json:"admin_name"`
		AdminEmail        string `json:"admin_email"`
		PaymentMethodType string `json:"payment_method_type"`
		FullName          string `json:"full_name"`
		Email             string `json:"email"`
		Phone             string `json:"phone"`
		Organization      string `json:"organization"`
		CardTokenID       string `json:"card_token_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.SiteName = strings.TrimSpace(req.SiteName)
	req.Subdomain = normalizeSubdomain(req.Subdomain)
	req.PlanCode = strings.TrimSpace(req.PlanCode)
	req.BillingCycle = normalizeBillingCycle(req.BillingCycle)
	req.Region = strings.TrimSpace(req.Region)
	if req.Region == "" {
		req.Region = store.SelfServeDefaultRegion
	}
	req.AdminName = strings.TrimSpace(req.AdminName)
	req.AdminEmail = strings.TrimSpace(req.AdminEmail)
	req.PaymentMethodType = normalizePaymentMethodType(req.PaymentMethodType)

	switch {
	case req.SiteName == "" || req.Subdomain == "" || req.PlanCode == "" || req.AdminName == "" || req.AdminEmail == "":
		writeError(w, http.StatusBadRequest, "Semua field wajib diisi")
		return
	case !isValidSubdomain(req.Subdomain) || isReservedSubdomain(req.Subdomain):
		writeError(w, http.StatusBadRequest, "Subdomain tidak valid")
		return
	case !looksLikeEmail(req.AdminEmail):
		writeError(w, http.StatusBadRequest, "Email administrator tidak valid")
		return
	case req.PaymentMethodType == "":
		writeError(w, http.StatusBadRequest, "Metode pembayaran wajib diisi")
		return
	case req.PaymentMethodType == "card" && s.billing.Name() == billing.ProviderMidtrans && strings.TrimSpace(req.CardTokenID) == "":
		writeError(w, http.StatusBadRequest, "Token kartu belum tersedia")
		return
	}

	plan, err := s.store.GetPlanByCode(r.Context(), req.PlanCode)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Paket tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !store.IsSelfServePlanCode(plan.Code) {
		writeError(w, http.StatusConflict, "Paket ini belum tersedia untuk pembuatan mandiri")
		return
	}

	available, err := s.store.IsSubdomainAvailable(r.Context(), req.Subdomain)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !available {
		writeError(w, http.StatusConflict, "Subdomain tidak tersedia")
		return
	}

	amountSubtotal, err := planAmountForCycle(plan, req.BillingCycle)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if amountSubtotal <= 0 {
		writeError(w, http.StatusConflict, "Paket ini tidak memerlukan checkout")
		return
	}
	amountTax := billingTax(amountSubtotal)
	amountTotal := amountSubtotal + amountTax

	fullName := strings.TrimSpace(req.FullName)
	if fullName == "" {
		fullName = strings.TrimSpace(user.Name)
	}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		email = strings.TrimSpace(user.Email)
	}
	phone := strings.TrimSpace(req.Phone)
	org := strings.TrimSpace(req.Organization)
	if org == "" {
		org = strings.TrimSpace(user.Organization)
	}

	customer, err := s.store.UpsertBillingCustomer(r.Context(), store.UpsertBillingCustomerParams{
		UserID:             user.ID,
		Provider:           s.billing.Name(),
		ProviderCustomerID: user.ID.String(),
		FullName:           fullName,
		Email:              email,
		Phone:              phone,
		Organization:       org,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	invoiceID := uuid.New()
	orderID := buildBillingOrderID(invoiceID)
	invoiceNumber := buildInvoiceNumber(invoiceID)
	returnURL := buildCheckoutReturnURL(s.frontendOriginForRequest(r), invoiceID)
	expiresAt := ptrTime(time.Now().UTC().Add(24 * time.Hour))

	invoice, attempt, err := s.store.CreateInvoiceWithAttempt(r.Context(), store.CreateInvoiceWithAttemptParams{
		OwnerUserID:        user.ID,
		CustomerID:         customer.ID,
		SiteID:             nil,
		SiteName:           req.SiteName,
		SiteSubdomain:      req.Subdomain,
		Provider:           s.billing.Name(),
		ExternalID:         orderID,
		Number:             invoiceNumber,
		Description:        fmt.Sprintf("Pembuatan situs %s", req.SiteName),
		Status:             "pending",
		Currency:           "IDR",
		BillingCycle:       req.BillingCycle,
		FromPlanCode:       "",
		ToPlanCode:         plan.Code,
		PaymentMethodType:  req.PaymentMethodType,
		AmountSubtotal:     amountSubtotal,
		AmountTax:          amountTax,
		AmountTotal:        amountTotal,
		ExpiresAt:          expiresAt,
		ItemType:           "site_create",
		ItemName:           plan.Name,
		ItemDescription:    fmt.Sprintf("Pembuatan situs %s untuk paket %s", req.SiteName, plan.Name),
		ItemQuantity:       1,
		ItemUnitAmount:     amountTotal,
		ItemTotalAmount:    amountTotal,
		ItemMetadata:       json.RawMessage(`{}`),
		AttemptStatus:      "created",
		AttemptRawResponse: json.RawMessage(`{}`),
		AttemptExpiresAt:   expiresAt,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if _, err := s.store.ReserveSiteCheckoutOrder(r.Context(), store.CreateSiteCheckoutOrderParams{
		OwnerUserID:       user.ID,
		InvoiceID:         invoice.ID,
		Status:            "pending_payment",
		SiteName:          req.SiteName,
		Subdomain:         req.Subdomain,
		PlanCode:          plan.Code,
		BillingCycle:      req.BillingCycle,
		Region:            req.Region,
		AdminName:         req.AdminName,
		AdminEmail:        req.AdminEmail,
		PaymentMethodType: req.PaymentMethodType,
		AmountTotal:       amountTotal,
		UsersActiveLimit:  plan.UsersActiveLimit,
		StorageBytesLimit: plan.StorageBytesLimit,
		WebCPUMillicores:  plan.WebCPUMillicores,
		WebMemoryMiB:      plan.WebMemoryMiB,
		CronCPUMillicores: plan.CronCPUMillicores,
		CronMemoryMiB:     plan.CronMemoryMiB,
		ExpiresAt:         expiresAt,
	}, store.HostCapacityPolicy{
		StorageBytesLimit:  s.cfg.HostStorageBudgetBytes,
		CPUMillicoresLimit: s.cfg.HostCPUMillicoresBudget,
		MemoryMiBLimit:     s.cfg.HostMemoryMiBBudget,
	}); err != nil {
		_, _, _ = s.store.UpdateInvoicePaymentState(r.Context(), store.UpdateInvoicePaymentStateParams{
			InvoiceID:            invoice.ID,
			Status:               "canceled",
			AttemptStatus:        "canceled",
			AttemptFailureReason: err.Error(),
			CanceledAt:           ptrTime(time.Now().UTC()),
			AttemptRawResponse:   json.RawMessage(`{}`),
		})
		status := http.StatusInternalServerError
		message := err.Error()
		switch {
		case errors.Is(err, store.ErrCapacityExceeded):
			status = http.StatusConflict
		case strings.Contains(strings.ToLower(err.Error()), "site_checkout_orders_active_subdomain_idx"):
			status = http.StatusConflict
			message = "Subdomain tidak tersedia"
		case strings.Contains(strings.ToLower(err.Error()), "subdomain"):
			status = http.StatusConflict
		}
		writeError(w, status, message)
		return
	}

	invoice, attempt, err = s.createProviderCheckoutForInvoice(r.Context(), invoice, req.PaymentMethodType, billing.Customer{
		ReferenceID:  user.ID.String(),
		FullName:     fullName,
		Email:        email,
		Phone:        phone,
		Organization: org,
	}, []billing.Item{
		{
			ID:          plan.Code,
			Name:        plan.Name,
			Description: fmt.Sprintf("Pembuatan situs %s", req.SiteName),
			Quantity:    1,
			Price:       amountTotal,
		},
	}, req.CardTokenID, returnURL)
	if err != nil {
		_, _ = s.store.CancelSiteCheckoutOrder(r.Context(), invoice.ID, err.Error())
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, billingCheckoutResponse{
		Invoice:  invoice,
		Attempt:  attempt,
		Message:  fmt.Sprintf("Checkout %s berhasil dibuat", invoice.Number),
		Provider: s.billing.PublicConfig(),
	})
}

func (s *Server) handleContinueBillingInvoiceCheckout(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	invoiceKey := strings.TrimSpace(chi.URLParam(r, "invoiceID"))
	if invoiceKey == "" {
		writeError(w, http.StatusBadRequest, "Invoice ID tidak valid")
		return
	}

	invoice, err := s.lookupBillingInvoiceForOwner(r.Context(), user.ID, invoiceKey)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Invoice tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if invoice.Status != "pending" {
		writeError(w, http.StatusConflict, "Invoice ini tidak lagi menunggu pembayaran")
		return
	}

	attempt, err := s.store.GetLatestPaymentAttemptByInvoiceID(r.Context(), invoice.ID)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if strings.TrimSpace(invoice.CheckoutURL) == "" {
		if normalizePaymentMethodType(invoice.PaymentMethodType) == "card" {
			writeError(w, http.StatusConflict, "Invoice kartu memerlukan checkout baru dari form pembayaran")
			return
		}

		customer, err := s.store.GetBillingCustomerByUserID(r.Context(), user.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		items, err := s.store.ListInvoiceItemsByInvoiceID(r.Context(), invoice.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		invoice, attempt, err = s.createProviderCheckoutForInvoice(r.Context(), invoice, invoice.PaymentMethodType, billing.Customer{
			ReferenceID:  user.ID.String(),
			FullName:     customer.FullName,
			Email:        customer.Email,
			Phone:        customer.Phone,
			Organization: customer.Organization,
		}, buildChargeItemsFromInvoiceItems(items, invoice.Description), "", buildCheckoutReturnURL(s.frontendOriginForRequest(r), invoice.ID))
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, billingCheckoutResponse{
		Invoice:  invoice,
		Attempt:  attempt,
		Message:  fmt.Sprintf("Checkout %s siap dilanjutkan", invoice.Number),
		Provider: s.billing.PublicConfig(),
	})
}

func (s *Server) handleMidtransWebhook(w http.ResponseWriter, r *http.Request) {
	if s.billing.Name() != billing.ProviderMidtrans {
		writeError(w, http.StatusServiceUnavailable, "Midtrans belum aktif")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Payload webhook tidak dapat dibaca")
		return
	}

	notification, err := s.billing.ParseWebhook(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.billing.VerifyWebhookSignature(notification); err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	event, inserted, err := s.store.CreateProviderWebhookEvent(r.Context(), store.CreateProviderWebhookEventParams{
		Provider:   notification.Provider,
		ExternalID: notification.ExternalID,
		EventType:  notification.EventType,
		Signature:  notification.SignatureKey,
		Payload:    notification.Raw,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !inserted && event.ProcessedAt != nil {
		writeJSON(w, http.StatusOK, map[string]string{"message": "Webhook sudah diproses"})
		return
	}

	var processingErr error
	defer func() {
		if err := s.store.MarkProviderWebhookEventProcessed(r.Context(), event.ID, errorText(processingErr)); err != nil {
			log.Printf("billing: mark provider webhook event processed failed event=%s: %v", event.ID, err)
		}
	}()

	invoice, err := s.store.GetInvoiceByExternalID(r.Context(), notification.ExternalID)
	if err != nil {
		processingErr = err
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Invoice tidak ditemukan")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	invoiceStatus, attemptStatus := paymentStateFromNotification(notification)
	providerResponse := billing.ChargeResponse{
		Provider:          notification.Provider,
		OrderID:           notification.ExternalID,
		StatusCode:        notification.StatusCode,
		StatusMessage:     notification.EventType,
		TransactionStatus: notification.TransactionStatus,
		FraudStatus:       notification.FraudStatus,
		PaymentMethodType: notification.PaymentMethodType,
		CheckoutURL:       notification.CheckoutURL,
		RedirectURL:       notification.RedirectURL,
		ExpiresAt:         notification.ExpiresAt,
		PaidAt:            notification.PaidAt,
		SavedTokenID:      notification.SavedTokenID,
		CardBrand:         notification.CardBrand,
		MaskedCard:        notification.MaskedCard,
		Raw:               notification.Raw,
	}

	invoice, _, err = s.store.UpdateInvoicePaymentState(r.Context(), store.UpdateInvoicePaymentStateParams{
		InvoiceID:            invoice.ID,
		Status:               invoiceStatus,
		CheckoutURL:          notification.CheckoutURL,
		RedirectURL:          notification.RedirectURL,
		PaymentMethodType:    notification.PaymentMethodType,
		AttemptStatus:        attemptStatus,
		AttemptRedirectURL:   notification.RedirectURL,
		AttemptFailureReason: notification.EventType,
		AttemptRawResponse:   notification.Raw,
		ExpiresAt:            notification.ExpiresAt,
		PaidAt:               notification.PaidAt,
		FailedAt:             failedAtForStatus(invoiceStatus),
		CanceledAt:           canceledAtForStatus(invoiceStatus),
	})
	if err != nil {
		processingErr = err
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if invoice.Status == "paid" {
		if err := s.finalizePaidInvoice(r.Context(), invoice, providerResponse); err != nil {
			processingErr = err
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Webhook diproses"})
}

func (s *Server) validatePlanChangeRequest(r *http.Request, ownerUserID, siteID uuid.UUID, targetPlanCode string) (store.Site, store.Plan, error) {
	currentSite, err := s.store.GetSiteByIDForOwner(r.Context(), ownerUserID, siteID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return store.Site{}, store.Plan{}, fmt.Errorf("%w: situs tidak ditemukan", store.ErrNotFound)
		}
		return store.Site{}, store.Plan{}, err
	}
	if currentSite.Status != "active" {
		return store.Site{}, store.Plan{}, fmt.Errorf("%w: situs harus aktif sebelum paket diubah", store.ErrConflict)
	}
	if !store.CanSelfServeUpgradeFromPlanCode(currentSite.PlanCode) {
		return store.Site{}, store.Plan{}, fmt.Errorf("%w: paket situs ini belum mendukung upgrade mandiri", store.ErrConflict)
	}

	targetPlan, err := s.store.GetPlanByCode(r.Context(), targetPlanCode)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return store.Site{}, store.Plan{}, fmt.Errorf("%w: paket tujuan tidak ditemukan", store.ErrNotFound)
		}
		return store.Site{}, store.Plan{}, err
	}
	if !store.IsSelfServePlanCode(targetPlan.Code) {
		return store.Site{}, store.Plan{}, fmt.Errorf("%w: paket tujuan belum tersedia untuk upgrade mandiri", store.ErrConflict)
	}
	if currentSite.PlanCode == targetPlan.Code {
		return store.Site{}, store.Plan{}, fmt.Errorf("%w: paket tujuan sama dengan paket aktif saat ini", store.ErrConflict)
	}
	if !store.IsSelfServeUpgradePath(currentSite.PlanCode, targetPlan.Code) {
		return store.Site{}, store.Plan{}, fmt.Errorf("%w: hanya upgrade ke paket self-serve yang lebih tinggi yang diperbolehkan", store.ErrConflict)
	}
	return currentSite, targetPlan, nil
}

func (s *Server) applySitePlanChange(ctx context.Context, ownerUserID uuid.UUID, currentSite store.Site, targetPlan store.Plan) (store.Site, *store.SiteUsageSnapshot, error) {
	provisioningStatus, err := s.store.GetProvisioningStatusBySiteID(ctx, ownerUserID, currentSite.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return store.Site{}, nil, fmt.Errorf("status provisioning situs belum lengkap untuk upgrade paket")
		}
		return store.Site{}, nil, err
	}
	if provisioningStatus.Runtime == nil {
		return store.Site{}, nil, fmt.Errorf("runtime situs belum siap untuk upgrade paket")
	}

	var customDomain *store.SiteCustomDomain
	domain, err := s.store.GetSiteCustomDomain(ctx, currentSite.ID)
	if err == nil {
		customDomain = &domain
	} else if !errors.Is(err, store.ErrNotFound) {
		return store.Site{}, nil, err
	}

	updatedSite, updatedUsage, err := s.store.UpdateSitePlan(ctx, store.UpdateSitePlanParams{
		OwnerUserID: ownerUserID,
		SiteID:      currentSite.ID,
		PlanCode:    targetPlan.Code,
	}, targetPlan, store.HostCapacityPolicy{
		StorageBytesLimit:  s.cfg.HostStorageBudgetBytes,
		CPUMillicoresLimit: s.cfg.HostCPUMillicoresBudget,
		MemoryMiBLimit:     s.cfg.HostMemoryMiBBudget,
	})
	if err != nil {
		return store.Site{}, nil, err
	}

	if _, err := s.runtime.ReconcileSite(ctx, updatedSite, provisioningStatus.Job, provisioningStatus.Runtime, customDomain); err != nil {
		rollbackSite, rollbackUsage, rollbackErr := s.store.UpdateSitePlan(ctx, store.UpdateSitePlanParams{
			OwnerUserID: ownerUserID,
			SiteID:      currentSite.ID,
			PlanCode:    currentSite.PlanCode,
		}, store.Plan{
			Code:              currentSite.PlanCode,
			UsersActiveLimit:  currentSite.UsersActiveLimit,
			StorageBytesLimit: currentSite.StorageBytesLimit,
			WebCPUMillicores:  currentSite.WebCPUMillicores,
			WebMemoryMiB:      currentSite.WebMemoryMiB,
			CronCPUMillicores: currentSite.CronCPUMillicores,
			CronMemoryMiB:     currentSite.CronMemoryMiB,
		}, store.HostCapacityPolicy{
			StorageBytesLimit:  s.cfg.HostStorageBudgetBytes,
			CPUMillicoresLimit: s.cfg.HostCPUMillicoresBudget,
			MemoryMiBLimit:     s.cfg.HostMemoryMiBBudget,
		})
		if rollbackErr == nil {
			if _, runtimeRollbackErr := s.runtime.ReconcileSite(ctx, rollbackSite, provisioningStatus.Job, provisioningStatus.Runtime, customDomain); runtimeRollbackErr != nil {
				log.Printf("billing: runtime rollback failed for site=%s: %v", currentSite.Subdomain, runtimeRollbackErr)
			}
			_ = rollbackUsage
		}

		message := fmt.Sprintf("upgrade paket gagal diterapkan: %v", err)
		if rollbackErr != nil {
			message = fmt.Sprintf("%s; rollback paket gagal: %v", message, rollbackErr)
		}
		return store.Site{}, nil, errors.New(message)
	}

	return updatedSite, updatedUsage, nil
}

func (s *Server) finalizePaidInvoice(ctx context.Context, invoice store.Invoice, response billing.ChargeResponse) error {
	return billing.Finalizer{
		Store:       s.store,
		AsynqClient: s.asynqClient,
		Runtime:     s.runtime,
		RuntimeMode: s.cfg.ProvisioningRuntimeMode,
		HostCapacityPolicy: store.HostCapacityPolicy{
			StorageBytesLimit:  s.cfg.HostStorageBudgetBytes,
			CPUMillicoresLimit: s.cfg.HostCPUMillicoresBudget,
			MemoryMiBLimit:     s.cfg.HostMemoryMiBBudget,
		},
		SiteURLBuilder: func(subdomain string) (string, string) {
			return siteURLForSubdomain(s.cfg, subdomain), adminURLForSubdomain(s.cfg, subdomain)
		},
	}.FinalizePaidInvoice(ctx, invoice, response)
}

func normalizeBillingCycle(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "yearly":
		return "yearly"
	default:
		return "monthly"
	}
}

func normalizePaymentMethodType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "card", "bank", "ewallet":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}

func planAmountForCycle(plan store.Plan, billingCycle string) (int64, error) {
	switch normalizeBillingCycle(billingCycle) {
	case "yearly":
		if plan.PriceYearly == nil {
			return 0, fmt.Errorf("paket ini belum memiliki harga tahunan")
		}
		return *plan.PriceYearly, nil
	default:
		if plan.PriceMonthly == nil {
			return 0, fmt.Errorf("paket ini belum memiliki harga bulanan")
		}
		return *plan.PriceMonthly, nil
	}
}

func billingTax(amount int64) int64 {
	return int64(math.Round(float64(amount) * 0.11))
}

func buildInvoiceNumber(invoiceID uuid.UUID) string {
	return fmt.Sprintf("INV-%s-%s", time.Now().UTC().Format("20060102"), strings.ToUpper(invoiceID.String()[:8]))
}

func buildBillingOrderID(invoiceID uuid.UUID) string {
	return "billing-" + invoiceID.String()
}

func buildCheckoutReturnURL(frontendOrigin string, invoiceID uuid.UUID) string {
	base := strings.TrimRight(strings.TrimSpace(frontendOrigin), "/")
	if base == "" {
		base = "http://localhost:3000"
	}
	return base + "/checkout/" + url.PathEscape(invoiceID.String())
}

func paymentStateFromProvider(response billing.ChargeResponse) (string, string) {
	if billing.IsPaidStatus(response.TransactionStatus, response.FraudStatus) {
		return "paid", "paid"
	}
	if billing.IsFailureStatus(response.TransactionStatus) {
		return failureInvoiceStatus(response.TransactionStatus), failureAttemptStatus(response.TransactionStatus)
	}
	return "pending", "pending"
}

func paymentStateFromNotification(notification billing.StatusNotification) (string, string) {
	if billing.IsPaidStatus(notification.TransactionStatus, notification.FraudStatus) {
		return "paid", "paid"
	}
	if billing.IsFailureStatus(notification.TransactionStatus) {
		return failureInvoiceStatus(notification.TransactionStatus), failureAttemptStatus(notification.TransactionStatus)
	}
	return "pending", "pending"
}

func failureInvoiceStatus(transactionStatus string) string {
	switch strings.ToLower(strings.TrimSpace(transactionStatus)) {
	case "cancel":
		return "canceled"
	case "expire":
		return "expired"
	default:
		return "failed"
	}
}

func failureAttemptStatus(transactionStatus string) string {
	switch strings.ToLower(strings.TrimSpace(transactionStatus)) {
	case "cancel":
		return "canceled"
	case "expire":
		return "expired"
	default:
		return "failed"
	}
}

func failedAtForStatus(status string) *time.Time {
	switch status {
	case "failed", "expired":
		return ptrTime(time.Now().UTC())
	default:
		return nil
	}
}

func canceledAtForStatus(status string) *time.Time {
	if status == "canceled" {
		return ptrTime(time.Now().UTC())
	}
	return nil
}

func ptrTime(value time.Time) *time.Time {
	utc := value.UTC()
	return &utc
}

func last4Digits(masked string) string {
	trimmed := strings.TrimSpace(masked)
	if len(trimmed) <= 4 {
		return trimmed
	}
	return trimmed[len(trimmed)-4:]
}

func errorText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}
