package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	invoiceSelectColumns = `
		id, owner_user_id, customer_id, site_id, site_name, site_subdomain, subscription_id, number, provider, external_id, description, status,
		currency, billing_cycle, from_plan_code, to_plan_code, payment_method_type, amount_subtotal, amount_tax,
		amount_total, checkout_url, redirect_url, expires_at, paid_at, canceled_at, failed_at, created_at, updated_at
	`
	subscriptionSelectColumns = `
		id, customer_id, owner_user_id, site_id, site_name, site_subdomain, payment_method_id, provider, provider_subscription_id, status, billing_cycle,
		collection_method, current_plan_code, pending_plan_code, currency, amount_total, anchor_at, current_period_start, current_period_end,
		next_charge_at, last_charge_failed_at, last_error, canceled_at, created_at, updated_at
	`
	paymentAttemptSelectColumns = `
		id, invoice_id, subscription_id, provider, external_id, payment_method_type, status, amount, redirect_url,
		failure_reason, raw_response, expires_at, paid_at, created_at, updated_at
	`
	invoiceItemSelectColumns = `
		id, invoice_id, item_type, name, description, quantity, unit_amount, total_amount, metadata, created_at, updated_at
	`
	siteCheckoutOrderSelectColumns = `
		id, owner_user_id, invoice_id, created_site_id, status, site_name, subdomain, plan_code, billing_cycle, region,
		admin_name, admin_email, payment_method_type, amount_total, users_active_limit, storage_bytes_limit, web_cpu_millicores,
		web_memory_mib, cron_cpu_millicores, cron_memory_mib, expires_at, paid_at, provisioning_started_at, completed_at, canceled_at,
		last_error, created_at, updated_at
	`
)

func normalizeJSON(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return []byte(`{}`)
	}
	return raw
}

func scanInvoice(row pgx.Row, invoice *Invoice) error {
	var siteID uuid.NullUUID
	if err := row.Scan(
		&invoice.ID,
		&invoice.OwnerUserID,
		&invoice.CustomerID,
		&siteID,
		&invoice.SiteName,
		&invoice.SiteSubdomain,
		&invoice.SubscriptionID,
		&invoice.Number,
		&invoice.Provider,
		&invoice.ExternalID,
		&invoice.Description,
		&invoice.Status,
		&invoice.Currency,
		&invoice.BillingCycle,
		&invoice.FromPlanCode,
		&invoice.ToPlanCode,
		&invoice.PaymentMethodType,
		&invoice.AmountSubtotal,
		&invoice.AmountTax,
		&invoice.AmountTotal,
		&invoice.CheckoutURL,
		&invoice.RedirectURL,
		&invoice.ExpiresAt,
		&invoice.PaidAt,
		&invoice.CanceledAt,
		&invoice.FailedAt,
		&invoice.CreatedAt,
		&invoice.UpdatedAt,
	); err != nil {
		return err
	}
	if siteID.Valid {
		invoice.SiteID = &siteID.UUID
	} else {
		invoice.SiteID = nil
	}
	return nil
}

func scanPaymentAttempt(row pgx.Row, attempt *PaymentAttempt) error {
	return row.Scan(
		&attempt.ID,
		&attempt.InvoiceID,
		&attempt.SubscriptionID,
		&attempt.Provider,
		&attempt.ExternalID,
		&attempt.PaymentMethodType,
		&attempt.Status,
		&attempt.Amount,
		&attempt.RedirectURL,
		&attempt.FailureReason,
		&attempt.RawResponse,
		&attempt.ExpiresAt,
		&attempt.PaidAt,
		&attempt.CreatedAt,
		&attempt.UpdatedAt,
	)
}

func scanBillingPaymentMethod(row pgx.Row, method *BillingPaymentMethod) error {
	return row.Scan(
		&method.ID,
		&method.CustomerID,
		&method.OwnerUserID,
		&method.Provider,
		&method.ProviderToken,
		&method.Type,
		&method.Brand,
		&method.Last4,
		&method.ExpiryMonth,
		&method.ExpiryYear,
		&method.Status,
		&method.Reusable,
		&method.IsDefault,
		&method.RawPayload,
		&method.CreatedAt,
		&method.UpdatedAt,
	)
}

func scanSubscription(row pgx.Row, subscription *Subscription) error {
	var siteID uuid.NullUUID
	if err := row.Scan(
		&subscription.ID,
		&subscription.CustomerID,
		&subscription.OwnerUserID,
		&siteID,
		&subscription.SiteName,
		&subscription.SiteSubdomain,
		&subscription.PaymentMethodID,
		&subscription.Provider,
		&subscription.ProviderSubscriptionID,
		&subscription.Status,
		&subscription.BillingCycle,
		&subscription.CollectionMethod,
		&subscription.CurrentPlanCode,
		&subscription.PendingPlanCode,
		&subscription.Currency,
		&subscription.AmountTotal,
		&subscription.AnchorAt,
		&subscription.CurrentPeriodStart,
		&subscription.CurrentPeriodEnd,
		&subscription.NextChargeAt,
		&subscription.LastChargeFailedAt,
		&subscription.LastError,
		&subscription.CanceledAt,
		&subscription.CreatedAt,
		&subscription.UpdatedAt,
	); err != nil {
		return err
	}
	if siteID.Valid {
		subscription.SiteID = &siteID.UUID
	} else {
		subscription.SiteID = nil
	}
	return nil
}

func scanInvoiceItem(row pgx.Row, item *InvoiceItem) error {
	return row.Scan(
		&item.ID,
		&item.InvoiceID,
		&item.ItemType,
		&item.Name,
		&item.Description,
		&item.Quantity,
		&item.UnitAmount,
		&item.TotalAmount,
		&item.Metadata,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
}

func scanSiteCheckoutOrder(row pgx.Row, order *SiteCheckoutOrder) error {
	var createdSiteID uuid.NullUUID
	if err := row.Scan(
		&order.ID,
		&order.OwnerUserID,
		&order.InvoiceID,
		&createdSiteID,
		&order.Status,
		&order.SiteName,
		&order.Subdomain,
		&order.PlanCode,
		&order.BillingCycle,
		&order.Region,
		&order.AdminName,
		&order.AdminEmail,
		&order.PaymentMethodType,
		&order.AmountTotal,
		&order.UsersActiveLimit,
		&order.StorageBytesLimit,
		&order.WebCPUMillicores,
		&order.WebMemoryMiB,
		&order.CronCPUMillicores,
		&order.CronMemoryMiB,
		&order.ExpiresAt,
		&order.PaidAt,
		&order.ProvisioningStartedAt,
		&order.CompletedAt,
		&order.CanceledAt,
		&order.LastError,
		&order.CreatedAt,
		&order.UpdatedAt,
	); err != nil {
		return err
	}
	if createdSiteID.Valid {
		order.CreatedSiteID = &createdSiteID.UUID
	} else {
		order.CreatedSiteID = nil
	}
	return nil
}

func (s *Store) UpsertBillingCustomer(ctx context.Context, params UpsertBillingCustomerParams) (BillingCustomer, error) {
	now := time.Now().UTC()
	customer := BillingCustomer{
		ID:                 uuid.New(),
		UserID:             params.UserID,
		Provider:           strings.TrimSpace(params.Provider),
		ProviderCustomerID: strings.TrimSpace(params.ProviderCustomerID),
		FullName:           strings.TrimSpace(params.FullName),
		Email:              strings.TrimSpace(params.Email),
		Phone:              strings.TrimSpace(params.Phone),
		Organization:       strings.TrimSpace(params.Organization),
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	err := s.pool.QueryRow(ctx, `
		INSERT INTO billing_customers (
			id, user_id, provider, provider_customer_id, full_name, email, phone, organization, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		ON CONFLICT (user_id) DO UPDATE SET
			provider = EXCLUDED.provider,
			provider_customer_id = EXCLUDED.provider_customer_id,
			full_name = EXCLUDED.full_name,
			email = EXCLUDED.email,
			phone = EXCLUDED.phone,
			organization = EXCLUDED.organization,
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, provider, provider_customer_id, full_name, email, phone, organization, created_at, updated_at
	`, customer.ID, customer.UserID, customer.Provider, customer.ProviderCustomerID, customer.FullName, customer.Email, customer.Phone, customer.Organization, customer.CreatedAt).Scan(
		&customer.ID,
		&customer.UserID,
		&customer.Provider,
		&customer.ProviderCustomerID,
		&customer.FullName,
		&customer.Email,
		&customer.Phone,
		&customer.Organization,
		&customer.CreatedAt,
		&customer.UpdatedAt,
	)
	if err != nil {
		return BillingCustomer{}, fmt.Errorf("upsert billing customer: %w", err)
	}
	return customer, nil
}

func (s *Store) GetBillingCustomerByUserID(ctx context.Context, userID uuid.UUID) (BillingCustomer, error) {
	var customer BillingCustomer
	err := s.pool.QueryRow(ctx, `
		SELECT id, user_id, provider, provider_customer_id, full_name, email, phone, organization, created_at, updated_at
		FROM billing_customers
		WHERE user_id = $1
	`, userID).Scan(
		&customer.ID,
		&customer.UserID,
		&customer.Provider,
		&customer.ProviderCustomerID,
		&customer.FullName,
		&customer.Email,
		&customer.Phone,
		&customer.Organization,
		&customer.CreatedAt,
		&customer.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BillingCustomer{}, ErrNotFound
		}
		return BillingCustomer{}, fmt.Errorf("get billing customer: %w", err)
	}
	return customer, nil
}

func (s *Store) CreateInvoiceWithAttempt(ctx context.Context, params CreateInvoiceWithAttemptParams) (Invoice, PaymentAttempt, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("begin create invoice tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now().UTC()
	invoice := Invoice{
		ID:                uuid.New(),
		OwnerUserID:       params.OwnerUserID,
		CustomerID:        params.CustomerID,
		SiteID:            params.SiteID,
		SiteName:          strings.TrimSpace(params.SiteName),
		SiteSubdomain:     strings.ToLower(strings.TrimSpace(params.SiteSubdomain)),
		SubscriptionID:    params.SubscriptionID,
		Number:            strings.TrimSpace(params.Number),
		Provider:          strings.TrimSpace(params.Provider),
		ExternalID:        strings.TrimSpace(params.ExternalID),
		Description:       strings.TrimSpace(params.Description),
		Status:            strings.TrimSpace(params.Status),
		Currency:          strings.TrimSpace(params.Currency),
		BillingCycle:      strings.TrimSpace(params.BillingCycle),
		FromPlanCode:      strings.TrimSpace(params.FromPlanCode),
		ToPlanCode:        strings.TrimSpace(params.ToPlanCode),
		PaymentMethodType: strings.TrimSpace(params.PaymentMethodType),
		AmountSubtotal:    params.AmountSubtotal,
		AmountTax:         params.AmountTax,
		AmountTotal:       params.AmountTotal,
		CheckoutURL:       strings.TrimSpace(params.CheckoutURL),
		RedirectURL:       strings.TrimSpace(params.RedirectURL),
		ExpiresAt:         params.ExpiresAt,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := scanInvoice(tx.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO invoices (
			id, owner_user_id, customer_id, site_id, site_name, site_subdomain, subscription_id, number, provider, external_id, description, status,
			currency, billing_cycle, from_plan_code, to_plan_code, payment_method_type, amount_subtotal, amount_tax,
			amount_total, checkout_url, redirect_url, expires_at, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16, $17, $18, $19,
			$20, $21, $22, $23, $24, $24
		)
		RETURNING %s
	`, invoiceSelectColumns), invoice.ID, invoice.OwnerUserID, invoice.CustomerID, invoice.SiteID, invoice.SiteName, invoice.SiteSubdomain, invoice.SubscriptionID, invoice.Number, invoice.Provider, invoice.ExternalID, invoice.Description, invoice.Status,
		invoice.Currency, invoice.BillingCycle, invoice.FromPlanCode, invoice.ToPlanCode, invoice.PaymentMethodType, invoice.AmountSubtotal, invoice.AmountTax,
		invoice.AmountTotal, invoice.CheckoutURL, invoice.RedirectURL, invoice.ExpiresAt, invoice.CreatedAt), &invoice); err != nil {
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("insert invoice: %w", err)
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO invoice_items (
			id, invoice_id, item_type, name, description, quantity, unit_amount, total_amount, metadata, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
	`), uuid.New(), invoice.ID, strings.TrimSpace(params.ItemType), strings.TrimSpace(params.ItemName), strings.TrimSpace(params.ItemDescription), params.ItemQuantity, params.ItemUnitAmount, params.ItemTotalAmount, normalizeJSON(params.ItemMetadata), now); err != nil {
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("insert invoice item: %w", err)
	}

	attempt := PaymentAttempt{
		ID:                uuid.New(),
		InvoiceID:         invoice.ID,
		SubscriptionID:    params.SubscriptionID,
		Provider:          invoice.Provider,
		ExternalID:        invoice.ExternalID,
		PaymentMethodType: invoice.PaymentMethodType,
		Status:            strings.TrimSpace(params.AttemptStatus),
		Amount:            invoice.AmountTotal,
		RedirectURL:       strings.TrimSpace(params.AttemptRedirectURL),
		RawResponse:       normalizeJSON(params.AttemptRawResponse),
		ExpiresAt:         params.AttemptExpiresAt,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := scanPaymentAttempt(tx.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO payment_attempts (
			id, invoice_id, subscription_id, provider, external_id, payment_method_type, status, amount, redirect_url,
			failure_reason, raw_response, expires_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '', $10, $11, $12, $12)
		RETURNING %s
	`, paymentAttemptSelectColumns), attempt.ID, attempt.InvoiceID, attempt.SubscriptionID, attempt.Provider, attempt.ExternalID, attempt.PaymentMethodType, attempt.Status, attempt.Amount, attempt.RedirectURL, attempt.RawResponse, attempt.ExpiresAt, attempt.CreatedAt), &attempt); err != nil {
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("insert payment attempt: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("commit create invoice tx: %w", err)
	}
	return invoice, attempt, nil
}

func (s *Store) UpdateInvoicePaymentState(ctx context.Context, params UpdateInvoicePaymentStateParams) (Invoice, PaymentAttempt, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("begin update invoice payment state tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now().UTC()
	var invoice Invoice
	if err := scanInvoice(tx.QueryRow(ctx, fmt.Sprintf(`
		UPDATE invoices
		SET
			status = CASE WHEN $2 <> '' THEN $2 ELSE status END,
			checkout_url = CASE WHEN $3 <> '' THEN $3 ELSE checkout_url END,
			redirect_url = CASE WHEN $4 <> '' THEN $4 ELSE redirect_url END,
			payment_method_type = CASE WHEN $5 <> '' THEN $5 ELSE payment_method_type END,
			expires_at = COALESCE($6, expires_at),
			paid_at = COALESCE($7, paid_at),
			failed_at = COALESCE($8, failed_at),
			canceled_at = COALESCE($9, canceled_at),
			updated_at = $10
		WHERE id = $1
		RETURNING %s
	`, invoiceSelectColumns), params.InvoiceID, strings.TrimSpace(params.Status), strings.TrimSpace(params.CheckoutURL), strings.TrimSpace(params.RedirectURL), strings.TrimSpace(params.PaymentMethodType), params.ExpiresAt, params.PaidAt, params.FailedAt, params.CanceledAt, now), &invoice); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invoice{}, PaymentAttempt{}, ErrNotFound
		}
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("update invoice payment state: %w", err)
	}

	var attempt PaymentAttempt
	if err := scanPaymentAttempt(tx.QueryRow(ctx, fmt.Sprintf(`
		UPDATE payment_attempts
		SET
			status = CASE WHEN $2 <> '' THEN $2 ELSE status END,
			redirect_url = CASE WHEN $3 <> '' THEN $3 ELSE redirect_url END,
			failure_reason = CASE WHEN $4 <> '' THEN $4 ELSE failure_reason END,
			raw_response = CASE WHEN $5::jsonb <> '{}'::jsonb THEN $5::jsonb ELSE raw_response END,
			expires_at = COALESCE($6, expires_at),
			paid_at = COALESCE($7, paid_at),
			updated_at = $8
		WHERE invoice_id = $1
		RETURNING %s
	`, paymentAttemptSelectColumns), params.InvoiceID, strings.TrimSpace(params.AttemptStatus), strings.TrimSpace(params.AttemptRedirectURL), strings.TrimSpace(params.AttemptFailureReason), normalizeJSON(params.AttemptRawResponse), params.ExpiresAt, params.PaidAt, now), &attempt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invoice{}, PaymentAttempt{}, ErrNotFound
		}
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("update payment attempt: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Invoice{}, PaymentAttempt{}, fmt.Errorf("commit update invoice payment state tx: %w", err)
	}
	return invoice, attempt, nil
}

func (s *Store) UpdateInvoiceSiteSnapshot(ctx context.Context, invoiceID uuid.UUID, siteID *uuid.UUID, siteName string, siteSubdomain string) (Invoice, error) {
	var invoice Invoice
	if err := scanInvoice(s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE invoices
		SET site_id = $2, site_name = $3, site_subdomain = $4, updated_at = $5
		WHERE id = $1
		RETURNING %s
	`, invoiceSelectColumns), invoiceID, siteID, strings.TrimSpace(siteName), strings.ToLower(strings.TrimSpace(siteSubdomain)), time.Now().UTC()), &invoice); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invoice{}, ErrNotFound
		}
		return Invoice{}, fmt.Errorf("update invoice site snapshot: %w", err)
	}
	return invoice, nil
}

func (s *Store) GetInvoiceByID(ctx context.Context, invoiceID uuid.UUID) (Invoice, error) {
	var invoice Invoice
	err := scanInvoice(s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM invoices
		WHERE id = $1
	`, invoiceSelectColumns), invoiceID), &invoice)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invoice{}, ErrNotFound
		}
		return Invoice{}, fmt.Errorf("get invoice by id: %w", err)
	}
	return invoice, nil
}

func (s *Store) GetInvoiceByIDForOwner(ctx context.Context, ownerUserID, invoiceID uuid.UUID) (Invoice, error) {
	var invoice Invoice
	err := scanInvoice(s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM invoices
		WHERE owner_user_id = $1 AND id = $2
	`, invoiceSelectColumns), ownerUserID, invoiceID), &invoice)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invoice{}, ErrNotFound
		}
		return Invoice{}, fmt.Errorf("get invoice by owner: %w", err)
	}
	return invoice, nil
}

func (s *Store) GetInvoiceByExternalID(ctx context.Context, externalID string) (Invoice, error) {
	var invoice Invoice
	err := scanInvoice(s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM invoices
		WHERE external_id = $1
	`, invoiceSelectColumns), strings.TrimSpace(externalID)), &invoice)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invoice{}, ErrNotFound
		}
		return Invoice{}, fmt.Errorf("get invoice by external id: %w", err)
	}
	return invoice, nil
}

func (s *Store) GetInvoiceByExternalIDForOwner(ctx context.Context, ownerUserID uuid.UUID, externalID string) (Invoice, error) {
	var invoice Invoice
	err := scanInvoice(s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM invoices
		WHERE owner_user_id = $1 AND external_id = $2
	`, invoiceSelectColumns), ownerUserID, strings.TrimSpace(externalID)), &invoice)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invoice{}, ErrNotFound
		}
		return Invoice{}, fmt.Errorf("get invoice by owner external id: %w", err)
	}
	return invoice, nil
}

func (s *Store) GetLatestPaymentAttemptByInvoiceID(ctx context.Context, invoiceID uuid.UUID) (PaymentAttempt, error) {
	var attempt PaymentAttempt
	err := scanPaymentAttempt(s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM payment_attempts
		WHERE invoice_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, paymentAttemptSelectColumns), invoiceID), &attempt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PaymentAttempt{}, ErrNotFound
		}
		return PaymentAttempt{}, fmt.Errorf("get payment attempt by invoice: %w", err)
	}
	return attempt, nil
}

func (s *Store) ListInvoiceItemsByInvoiceID(ctx context.Context, invoiceID uuid.UUID) ([]InvoiceItem, error) {
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT %s
		FROM invoice_items
		WHERE invoice_id = $1
		ORDER BY created_at ASC
	`, invoiceItemSelectColumns), invoiceID)
	if err != nil {
		return nil, fmt.Errorf("list invoice items: %w", err)
	}
	defer rows.Close()

	items := make([]InvoiceItem, 0)
	for rows.Next() {
		var item InvoiceItem
		if err := scanInvoiceItem(rows, &item); err != nil {
			return nil, fmt.Errorf("scan invoice item: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ListInvoicesByOwner(ctx context.Context, ownerUserID uuid.UUID, limit int) ([]Invoice, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT %s
		FROM invoices
		WHERE owner_user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, invoiceSelectColumns), ownerUserID, limit)
	if err != nil {
		return nil, fmt.Errorf("list invoices by owner: %w", err)
	}
	defer rows.Close()

	items := make([]Invoice, 0)
	for rows.Next() {
		var item Invoice
		if err := scanInvoice(rows, &item); err != nil {
			return nil, fmt.Errorf("scan invoice: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) FindPendingInvoiceBySubscriptionID(ctx context.Context, subscriptionID uuid.UUID) (Invoice, error) {
	var invoice Invoice
	err := scanInvoice(s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM invoices
		WHERE subscription_id = $1 AND status = 'pending'
		ORDER BY created_at DESC
		LIMIT 1
	`, invoiceSelectColumns), subscriptionID), &invoice)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Invoice{}, ErrNotFound
		}
		return Invoice{}, fmt.Errorf("find pending invoice by subscription: %w", err)
	}
	return invoice, nil
}

func (s *Store) UpsertBillingPaymentMethod(ctx context.Context, params UpsertBillingPaymentMethodParams) (BillingPaymentMethod, error) {
	now := time.Now().UTC()
	method := BillingPaymentMethod{
		ID:            uuid.New(),
		CustomerID:    params.CustomerID,
		OwnerUserID:   params.OwnerUserID,
		Provider:      strings.TrimSpace(params.Provider),
		ProviderToken: strings.TrimSpace(params.ProviderToken),
		Type:          strings.TrimSpace(params.Type),
		Brand:         strings.TrimSpace(params.Brand),
		Last4:         strings.TrimSpace(params.Last4),
		ExpiryMonth:   strings.TrimSpace(params.ExpiryMonth),
		ExpiryYear:    strings.TrimSpace(params.ExpiryYear),
		Status:        strings.TrimSpace(params.Status),
		Reusable:      params.Reusable,
		IsDefault:     params.IsDefault,
		RawPayload:    normalizeJSON(params.RawPayload),
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if method.IsDefault {
		if _, err := s.pool.Exec(ctx, `
			UPDATE billing_payment_methods
			SET is_default = FALSE, updated_at = $2
			WHERE owner_user_id = $1
		`, method.OwnerUserID, now); err != nil {
			return BillingPaymentMethod{}, fmt.Errorf("clear default payment methods: %w", err)
		}
	}

	if err := scanBillingPaymentMethod(s.pool.QueryRow(ctx, `
		INSERT INTO billing_payment_methods (
			id, customer_id, owner_user_id, provider, provider_token, type, brand, last4, expiry_month, expiry_year,
			status, reusable, is_default, raw_payload, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
		ON CONFLICT (provider, provider_token) DO UPDATE SET
			customer_id = EXCLUDED.customer_id,
			owner_user_id = EXCLUDED.owner_user_id,
			type = EXCLUDED.type,
			brand = EXCLUDED.brand,
			last4 = EXCLUDED.last4,
			expiry_month = EXCLUDED.expiry_month,
			expiry_year = EXCLUDED.expiry_year,
			status = EXCLUDED.status,
			reusable = EXCLUDED.reusable,
			is_default = EXCLUDED.is_default,
			raw_payload = EXCLUDED.raw_payload,
			updated_at = EXCLUDED.updated_at
		RETURNING
			id, customer_id, owner_user_id, provider, provider_token, type, brand, last4, expiry_month, expiry_year,
			status, reusable, is_default, raw_payload, created_at, updated_at
	`, method.ID, method.CustomerID, method.OwnerUserID, method.Provider, method.ProviderToken, method.Type, method.Brand, method.Last4, method.ExpiryMonth, method.ExpiryYear, method.Status, method.Reusable, method.IsDefault, method.RawPayload, method.CreatedAt), &method); err != nil {
		return BillingPaymentMethod{}, fmt.Errorf("upsert billing payment method: %w", err)
	}
	return method, nil
}

func (s *Store) ListBillingPaymentMethodsByOwner(ctx context.Context, ownerUserID uuid.UUID) ([]BillingPaymentMethod, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			id, customer_id, owner_user_id, provider, provider_token, type, brand, last4, expiry_month, expiry_year,
			status, reusable, is_default, raw_payload, created_at, updated_at
		FROM billing_payment_methods
		WHERE owner_user_id = $1
		ORDER BY is_default DESC, created_at DESC
	`, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("list billing payment methods by owner: %w", err)
	}
	defer rows.Close()

	items := make([]BillingPaymentMethod, 0)
	for rows.Next() {
		var item BillingPaymentMethod
		if err := scanBillingPaymentMethod(rows, &item); err != nil {
			return nil, fmt.Errorf("scan billing payment method: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) UpsertSubscription(ctx context.Context, params UpsertSubscriptionParams) (Subscription, error) {
	now := time.Now().UTC()
	var existing Subscription
	var err error
	if params.SiteID != nil {
		existing, err = s.GetActiveSubscriptionBySiteID(ctx, *params.SiteID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return Subscription{}, err
		}
	}

	collectionMethod := strings.TrimSpace(params.CollectionMethod)
	if collectionMethod == "" {
		if params.PaymentMethodID != nil {
			collectionMethod = "auto_charge"
		} else {
			collectionMethod = "manual_invoice"
		}
	}

	subscription := Subscription{
		ID:                     uuid.New(),
		CustomerID:             params.CustomerID,
		OwnerUserID:            params.OwnerUserID,
		SiteID:                 params.SiteID,
		SiteName:               strings.TrimSpace(params.SiteName),
		SiteSubdomain:          strings.ToLower(strings.TrimSpace(params.SiteSubdomain)),
		PaymentMethodID:        params.PaymentMethodID,
		Provider:               strings.TrimSpace(params.Provider),
		ProviderSubscriptionID: strings.TrimSpace(params.ProviderSubscriptionID),
		Status:                 strings.TrimSpace(params.Status),
		BillingCycle:           strings.TrimSpace(params.BillingCycle),
		CollectionMethod:       collectionMethod,
		CurrentPlanCode:        strings.TrimSpace(params.CurrentPlanCode),
		PendingPlanCode:        strings.TrimSpace(params.PendingPlanCode),
		Currency:               strings.TrimSpace(params.Currency),
		AmountTotal:            params.AmountTotal,
		AnchorAt:               params.AnchorAt,
		CurrentPeriodStart:     params.CurrentPeriodStart,
		CurrentPeriodEnd:       params.CurrentPeriodEnd,
		NextChargeAt:           params.NextChargeAt,
		LastChargeFailedAt:     params.LastChargeFailedAt,
		LastError:              strings.TrimSpace(params.LastError),
		CanceledAt:             params.CanceledAt,
		CreatedAt:              now,
		UpdatedAt:              now,
	}
	if err == nil && existing.ID != uuid.Nil {
		subscription.ID = existing.ID
		subscription.CreatedAt = existing.CreatedAt
	}

	if err := scanSubscription(s.pool.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO subscriptions (
			id, customer_id, owner_user_id, site_id, site_name, site_subdomain, payment_method_id, provider, provider_subscription_id, status, billing_cycle,
			collection_method, current_plan_code, pending_plan_code, currency, amount_total, anchor_at, current_period_start, current_period_end,
			next_charge_at, last_charge_failed_at, last_error, canceled_at, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17, $18, $19,
			$20, $21, $22, $23, $24, $24
		)
		ON CONFLICT (id) DO UPDATE SET
			customer_id = EXCLUDED.customer_id,
			owner_user_id = EXCLUDED.owner_user_id,
			site_id = EXCLUDED.site_id,
			site_name = EXCLUDED.site_name,
			site_subdomain = EXCLUDED.site_subdomain,
			payment_method_id = EXCLUDED.payment_method_id,
			provider = EXCLUDED.provider,
			provider_subscription_id = EXCLUDED.provider_subscription_id,
			status = EXCLUDED.status,
			billing_cycle = EXCLUDED.billing_cycle,
			collection_method = EXCLUDED.collection_method,
			current_plan_code = EXCLUDED.current_plan_code,
			pending_plan_code = EXCLUDED.pending_plan_code,
			currency = EXCLUDED.currency,
			amount_total = EXCLUDED.amount_total,
			anchor_at = EXCLUDED.anchor_at,
			current_period_start = EXCLUDED.current_period_start,
			current_period_end = EXCLUDED.current_period_end,
			next_charge_at = EXCLUDED.next_charge_at,
			last_charge_failed_at = EXCLUDED.last_charge_failed_at,
			last_error = EXCLUDED.last_error,
			canceled_at = EXCLUDED.canceled_at,
			updated_at = EXCLUDED.updated_at
		RETURNING %s
	`, subscriptionSelectColumns), subscription.ID, subscription.CustomerID, subscription.OwnerUserID, subscription.SiteID, subscription.SiteName, subscription.SiteSubdomain, subscription.PaymentMethodID, subscription.Provider, subscription.ProviderSubscriptionID, subscription.Status, subscription.BillingCycle,
		subscription.CollectionMethod, subscription.CurrentPlanCode, subscription.PendingPlanCode, subscription.Currency, subscription.AmountTotal, subscription.AnchorAt, subscription.CurrentPeriodStart, subscription.CurrentPeriodEnd,
		subscription.NextChargeAt, subscription.LastChargeFailedAt, subscription.LastError, subscription.CanceledAt, subscription.CreatedAt), &subscription); err != nil {
		return Subscription{}, fmt.Errorf("upsert subscription: %w", err)
	}
	return subscription, nil
}

func (s *Store) GetActiveSubscriptionBySiteID(ctx context.Context, siteID uuid.UUID) (Subscription, error) {
	var subscription Subscription
	err := scanSubscription(s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM subscriptions
		WHERE site_id = $1 AND status IN ('active', 'past_due')
		ORDER BY updated_at DESC
		LIMIT 1
	`, subscriptionSelectColumns), siteID), &subscription)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Subscription{}, ErrNotFound
		}
		return Subscription{}, fmt.Errorf("get active subscription by site id: %w", err)
	}
	return subscription, nil
}

func (s *Store) ListSubscriptionsByOwner(ctx context.Context, ownerUserID uuid.UUID) ([]Subscription, error) {
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT %s
		FROM subscriptions
		WHERE owner_user_id = $1
		ORDER BY updated_at DESC
	`, subscriptionSelectColumns), ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("list subscriptions by owner: %w", err)
	}
	defer rows.Close()

	items := make([]Subscription, 0)
	for rows.Next() {
		var item Subscription
		if err := scanSubscription(rows, &item); err != nil {
			return nil, fmt.Errorf("scan subscription: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ListDueSubscriptions(ctx context.Context, now time.Time) ([]DueSubscriptionCandidate, error) {
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT
			%s,
			c.id, c.user_id, c.provider, c.provider_customer_id, c.full_name, c.email, c.phone, c.organization, c.created_at, c.updated_at,
			pm.id,
			COALESCE(pm.customer_id, '00000000-0000-0000-0000-000000000000'::uuid),
			COALESCE(pm.owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
			COALESCE(pm.provider, ''), COALESCE(pm.provider_token, ''), COALESCE(pm.type, ''), COALESCE(pm.brand, ''), COALESCE(pm.last4, ''),
			COALESCE(pm.expiry_month, ''), COALESCE(pm.expiry_year, ''), COALESCE(pm.status, ''), COALESCE(pm.reusable, FALSE),
			COALESCE(pm.is_default, FALSE), COALESCE(pm.raw_payload, '{}'::jsonb), pm.created_at, pm.updated_at,
			s.id, s.owner_user_id, s.name, s.subdomain, s.plan_code, s.region, s.status, s.site_url, s.admin_url,
			s.admin_name, s.admin_email, s.moodle_username, s.provisioning_step, s.last_error,
			s.users_active_limit, s.storage_bytes_limit, s.web_cpu_millicores, s.web_memory_mib,
			s.cron_cpu_millicores, s.cron_memory_mib, s.activated_at, s.created_at, s.updated_at
		FROM subscriptions sub
		JOIN billing_customers c ON c.id = sub.customer_id
		LEFT JOIN billing_payment_methods pm ON pm.id = sub.payment_method_id
		JOIN sites s ON s.id = sub.site_id
		WHERE sub.status = 'active'
			AND sub.next_charge_at IS NOT NULL
			AND sub.next_charge_at <= $1
		ORDER BY sub.next_charge_at ASC
	`, subscriptionSelectColumns), now)
	if err != nil {
		return nil, fmt.Errorf("list due subscriptions: %w", err)
	}
	defer rows.Close()

	items := make([]DueSubscriptionCandidate, 0)
	for rows.Next() {
		var item DueSubscriptionCandidate
		var subSiteID uuid.NullUUID
		var pmID uuid.NullUUID
		if err := rows.Scan(
			&item.Subscription.ID,
			&item.Subscription.CustomerID,
			&item.Subscription.OwnerUserID,
			&subSiteID,
			&item.Subscription.SiteName,
			&item.Subscription.SiteSubdomain,
			&item.Subscription.PaymentMethodID,
			&item.Subscription.Provider,
			&item.Subscription.ProviderSubscriptionID,
			&item.Subscription.Status,
			&item.Subscription.BillingCycle,
			&item.Subscription.CollectionMethod,
			&item.Subscription.CurrentPlanCode,
			&item.Subscription.PendingPlanCode,
			&item.Subscription.Currency,
			&item.Subscription.AmountTotal,
			&item.Subscription.AnchorAt,
			&item.Subscription.CurrentPeriodStart,
			&item.Subscription.CurrentPeriodEnd,
			&item.Subscription.NextChargeAt,
			&item.Subscription.LastChargeFailedAt,
			&item.Subscription.LastError,
			&item.Subscription.CanceledAt,
			&item.Subscription.CreatedAt,
			&item.Subscription.UpdatedAt,
			&item.Customer.ID, &item.Customer.UserID, &item.Customer.Provider, &item.Customer.ProviderCustomerID, &item.Customer.FullName, &item.Customer.Email, &item.Customer.Phone, &item.Customer.Organization, &item.Customer.CreatedAt, &item.Customer.UpdatedAt,
			&pmID,
			&item.PaymentMethod.CustomerID,
			&item.PaymentMethod.OwnerUserID,
			&item.PaymentMethod.Provider,
			&item.PaymentMethod.ProviderToken,
			&item.PaymentMethod.Type,
			&item.PaymentMethod.Brand,
			&item.PaymentMethod.Last4,
			&item.PaymentMethod.ExpiryMonth,
			&item.PaymentMethod.ExpiryYear,
			&item.PaymentMethod.Status,
			&item.PaymentMethod.Reusable,
			&item.PaymentMethod.IsDefault,
			&item.PaymentMethod.RawPayload,
			&item.PaymentMethod.CreatedAt,
			&item.PaymentMethod.UpdatedAt,
			&item.Site.ID, &item.Site.OwnerUserID, &item.Site.Name, &item.Site.Subdomain, &item.Site.PlanCode, &item.Site.Region, &item.Site.Status, &item.Site.SiteURL, &item.Site.AdminURL,
			&item.Site.AdminName, &item.Site.AdminEmail, &item.Site.MoodleUsername, &item.Site.ProvisioningStep, &item.Site.LastError,
			&item.Site.UsersActiveLimit, &item.Site.StorageBytesLimit, &item.Site.WebCPUMillicores, &item.Site.WebMemoryMiB,
			&item.Site.CronCPUMillicores, &item.Site.CronMemoryMiB, &item.Site.ActivatedAt, &item.Site.CreatedAt, &item.Site.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan due subscription: %w", err)
		}
		if subSiteID.Valid {
			item.Subscription.SiteID = &subSiteID.UUID
		} else {
			item.Subscription.SiteID = nil
		}
		if pmID.Valid {
			item.PaymentMethod.ID = pmID.UUID
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) AdvanceSubscriptionAfterRenewal(ctx context.Context, subscriptionID uuid.UUID, invoiceID uuid.UUID, paidAt time.Time, periodEnd time.Time) (Subscription, error) {
	var subscription Subscription
	if err := scanSubscription(s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE subscriptions
		SET
			status = 'active',
			current_period_start = $2,
			current_period_end = $3,
			next_charge_at = $3,
			last_charge_failed_at = NULL,
			last_error = '',
			updated_at = $4
		WHERE id = $1
		RETURNING %s
	`, subscriptionSelectColumns), subscriptionID, paidAt, periodEnd, time.Now().UTC()), &subscription); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Subscription{}, ErrNotFound
		}
		return Subscription{}, fmt.Errorf("advance subscription after renewal: %w", err)
	}
	_ = invoiceID
	return subscription, nil
}

func (s *Store) MarkSubscriptionPastDue(ctx context.Context, subscriptionID uuid.UUID, failedAt time.Time, reason string) (Subscription, error) {
	var subscription Subscription
	if err := scanSubscription(s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE subscriptions
		SET
			status = 'past_due',
			last_charge_failed_at = $2,
			last_error = $3,
			updated_at = $4
		WHERE id = $1
		RETURNING %s
	`, subscriptionSelectColumns), subscriptionID, failedAt, strings.TrimSpace(reason), time.Now().UTC()), &subscription); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Subscription{}, ErrNotFound
		}
		return Subscription{}, fmt.Errorf("mark subscription past due: %w", err)
	}
	return subscription, nil
}

func (s *Store) CancelSubscriptionsBySiteID(ctx context.Context, ownerUserID, siteID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE subscriptions
		SET status = 'canceled', canceled_at = COALESCE(canceled_at, $3), updated_at = $3
		WHERE owner_user_id = $1
			AND site_id = $2
			AND status IN ('active', 'past_due')
	`, ownerUserID, siteID, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("cancel subscriptions by site: %w", err)
	}
	return nil
}

func (s *Store) CancelPendingInvoicesBySiteID(ctx context.Context, ownerUserID, siteID uuid.UUID) error {
	now := time.Now().UTC()
	if _, err := s.pool.Exec(ctx, `
		UPDATE invoices
		SET status = 'canceled', canceled_at = COALESCE(canceled_at, $3), updated_at = $3
		WHERE owner_user_id = $1
			AND site_id = $2
			AND status = 'pending'
	`, ownerUserID, siteID, now); err != nil {
		return fmt.Errorf("cancel pending invoices by site: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `
		UPDATE payment_attempts
		SET status = 'canceled', updated_at = $2
		WHERE invoice_id IN (
			SELECT id FROM invoices
			WHERE owner_user_id = $1 AND site_id = $3 AND status = 'canceled'
		)
	`, ownerUserID, now, siteID); err != nil {
		return fmt.Errorf("cancel pending payment attempts by site: %w", err)
	}
	return nil
}

func (s *Store) CreateSiteCheckoutOrder(ctx context.Context, params CreateSiteCheckoutOrderParams) (SiteCheckoutOrder, error) {
	now := time.Now().UTC()
	order := SiteCheckoutOrder{
		ID:                uuid.New(),
		OwnerUserID:       params.OwnerUserID,
		InvoiceID:         params.InvoiceID,
		Status:            strings.TrimSpace(params.Status),
		SiteName:          strings.TrimSpace(params.SiteName),
		Subdomain:         strings.ToLower(strings.TrimSpace(params.Subdomain)),
		PlanCode:          strings.TrimSpace(params.PlanCode),
		BillingCycle:      strings.TrimSpace(params.BillingCycle),
		Region:            strings.TrimSpace(params.Region),
		AdminName:         strings.TrimSpace(params.AdminName),
		AdminEmail:        strings.TrimSpace(params.AdminEmail),
		PaymentMethodType: strings.TrimSpace(params.PaymentMethodType),
		AmountTotal:       params.AmountTotal,
		UsersActiveLimit:  params.UsersActiveLimit,
		StorageBytesLimit: params.StorageBytesLimit,
		WebCPUMillicores:  params.WebCPUMillicores,
		WebMemoryMiB:      params.WebMemoryMiB,
		CronCPUMillicores: params.CronCPUMillicores,
		CronMemoryMiB:     params.CronMemoryMiB,
		ExpiresAt:         params.ExpiresAt,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if order.Status == "" {
		order.Status = "pending_payment"
	}

	if err := scanSiteCheckoutOrder(s.pool.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO site_checkout_orders (
			id, owner_user_id, invoice_id, status, site_name, subdomain, plan_code, billing_cycle, region, admin_name, admin_email,
			payment_method_type, amount_total, users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, expires_at, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17,
			$18, $19, $20, $21, $21
		)
		RETURNING %s
	`, siteCheckoutOrderSelectColumns), order.ID, order.OwnerUserID, order.InvoiceID, order.Status, order.SiteName, order.Subdomain, order.PlanCode, order.BillingCycle, order.Region, order.AdminName, order.AdminEmail,
		order.PaymentMethodType, order.AmountTotal, order.UsersActiveLimit, order.StorageBytesLimit, order.WebCPUMillicores, order.WebMemoryMiB,
		order.CronCPUMillicores, order.CronMemoryMiB, order.ExpiresAt, order.CreatedAt), &order); err != nil {
		return SiteCheckoutOrder{}, fmt.Errorf("create site checkout order: %w", err)
	}
	return order, nil
}

func (s *Store) ReserveSiteCheckoutOrder(ctx context.Context, params CreateSiteCheckoutOrderParams, capacity HostCapacityPolicy) (SiteCheckoutOrder, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SiteCheckoutOrder{}, fmt.Errorf("begin reserve site checkout order tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, int64(2026031701)); err != nil {
		return SiteCheckoutOrder{}, fmt.Errorf("lock host capacity policy: %w", err)
	}

	plan := Plan{
		Code:              strings.TrimSpace(params.PlanCode),
		UsersActiveLimit:  params.UsersActiveLimit,
		StorageBytesLimit: params.StorageBytesLimit,
		WebCPUMillicores:  params.WebCPUMillicores,
		WebMemoryMiB:      params.WebMemoryMiB,
		CronCPUMillicores: params.CronCPUMillicores,
		CronMemoryMiB:     params.CronMemoryMiB,
	}
	if err := validateHostCapacityWithReservations(ctx, tx, plan, capacity, nil); err != nil {
		return SiteCheckoutOrder{}, err
	}

	now := time.Now().UTC()
	order := SiteCheckoutOrder{
		ID:                uuid.New(),
		OwnerUserID:       params.OwnerUserID,
		InvoiceID:         params.InvoiceID,
		Status:            strings.TrimSpace(params.Status),
		SiteName:          strings.TrimSpace(params.SiteName),
		Subdomain:         strings.ToLower(strings.TrimSpace(params.Subdomain)),
		PlanCode:          strings.TrimSpace(params.PlanCode),
		BillingCycle:      strings.TrimSpace(params.BillingCycle),
		Region:            strings.TrimSpace(params.Region),
		AdminName:         strings.TrimSpace(params.AdminName),
		AdminEmail:        strings.TrimSpace(params.AdminEmail),
		PaymentMethodType: strings.TrimSpace(params.PaymentMethodType),
		AmountTotal:       params.AmountTotal,
		UsersActiveLimit:  params.UsersActiveLimit,
		StorageBytesLimit: params.StorageBytesLimit,
		WebCPUMillicores:  params.WebCPUMillicores,
		WebMemoryMiB:      params.WebMemoryMiB,
		CronCPUMillicores: params.CronCPUMillicores,
		CronMemoryMiB:     params.CronMemoryMiB,
		ExpiresAt:         params.ExpiresAt,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if order.Status == "" {
		order.Status = "pending_payment"
	}

	if err := scanSiteCheckoutOrder(tx.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO site_checkout_orders (
			id, owner_user_id, invoice_id, status, site_name, subdomain, plan_code, billing_cycle, region, admin_name, admin_email,
			payment_method_type, amount_total, users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, expires_at, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17,
			$18, $19, $20, $21, $21
		)
		RETURNING %s
	`, siteCheckoutOrderSelectColumns), order.ID, order.OwnerUserID, order.InvoiceID, order.Status, order.SiteName, order.Subdomain, order.PlanCode, order.BillingCycle, order.Region, order.AdminName, order.AdminEmail,
		order.PaymentMethodType, order.AmountTotal, order.UsersActiveLimit, order.StorageBytesLimit, order.WebCPUMillicores, order.WebMemoryMiB,
		order.CronCPUMillicores, order.CronMemoryMiB, order.ExpiresAt, order.CreatedAt), &order); err != nil {
		return SiteCheckoutOrder{}, fmt.Errorf("reserve site checkout order: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return SiteCheckoutOrder{}, fmt.Errorf("commit reserve site checkout order tx: %w", err)
	}
	return order, nil
}

func (s *Store) GetSiteCheckoutOrderByInvoiceID(ctx context.Context, invoiceID uuid.UUID) (SiteCheckoutOrder, error) {
	var order SiteCheckoutOrder
	err := scanSiteCheckoutOrder(s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM site_checkout_orders
		WHERE invoice_id = $1
	`, siteCheckoutOrderSelectColumns), invoiceID), &order)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteCheckoutOrder{}, ErrNotFound
		}
		return SiteCheckoutOrder{}, fmt.Errorf("get site checkout order by invoice: %w", err)
	}
	return order, nil
}

func (s *Store) MarkSiteCheckoutOrderPaid(ctx context.Context, invoiceID uuid.UUID, paidAt time.Time) (SiteCheckoutOrder, error) {
	var order SiteCheckoutOrder
	if err := scanSiteCheckoutOrder(s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE site_checkout_orders
		SET status = 'paid', paid_at = COALESCE(paid_at, $2), updated_at = $2
		WHERE invoice_id = $1
		RETURNING %s
	`, siteCheckoutOrderSelectColumns), invoiceID, paidAt.UTC()), &order); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteCheckoutOrder{}, ErrNotFound
		}
		return SiteCheckoutOrder{}, fmt.Errorf("mark site checkout order paid: %w", err)
	}
	return order, nil
}

func (s *Store) CancelSiteCheckoutOrder(ctx context.Context, invoiceID uuid.UUID, reason string) (SiteCheckoutOrder, error) {
	var order SiteCheckoutOrder
	now := time.Now().UTC()
	if err := scanSiteCheckoutOrder(s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE site_checkout_orders
		SET
			status = 'canceled',
			canceled_at = COALESCE(canceled_at, $2),
			last_error = CASE WHEN $3 <> '' THEN $3 ELSE last_error END,
			updated_at = $2
		WHERE invoice_id = $1
		RETURNING %s
	`, siteCheckoutOrderSelectColumns), invoiceID, now, strings.TrimSpace(reason)), &order); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteCheckoutOrder{}, ErrNotFound
		}
		return SiteCheckoutOrder{}, fmt.Errorf("cancel site checkout order: %w", err)
	}
	return order, nil
}

func (s *Store) CreateSiteFromCheckoutOrder(ctx context.Context, invoiceID uuid.UUID, runtimeMode string, capacity HostCapacityPolicy, siteURL string, adminURL string) (SiteCheckoutOrder, Site, ProvisioningJob, []ProvisioningEvent, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("begin create site from checkout order tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, int64(2026031701)); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("lock host capacity policy: %w", err)
	}

	var order SiteCheckoutOrder
	if err := scanSiteCheckoutOrder(tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s
		FROM site_checkout_orders
		WHERE invoice_id = $1
		FOR UPDATE
	`, siteCheckoutOrderSelectColumns), invoiceID), &order); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, ErrNotFound
		}
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("get site checkout order for provisioning: %w", err)
	}
	if order.CreatedSiteID != nil {
		site, err := getSiteByID(ctx, tx, *order.CreatedSiteID)
		if err != nil {
			return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, err
		}
		job, events, err := getProvisioningBundleBySiteID(ctx, tx, site.ID)
		if err != nil {
			return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("commit existing create site order tx: %w", err)
		}
		return order, site, job, events, nil
	}
	if order.Status == "expired" || order.Status == "canceled" {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("%w: checkout pembuatan situs sudah tidak aktif", ErrConflict)
	}

	plan, err := getPlanByCodeTx(ctx, tx, order.PlanCode)
	if err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, err
	}
	if err := validateHostCapacityWithReservations(ctx, tx, plan, capacity, &order.ID); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, err
	}

	siteURL = strings.TrimSpace(siteURL)
	adminURL = strings.TrimSpace(adminURL)
	if siteURL == "" {
		siteURL = fmt.Sprintf("https://%s.moodlepilot.id", order.Subdomain)
	}
	if adminURL == "" {
		adminURL = fmt.Sprintf("%s/admin", strings.TrimRight(siteURL, "/"))
	}
	now := time.Now().UTC()
	site := Site{
		ID:                uuid.New(),
		OwnerUserID:       order.OwnerUserID,
		Name:              order.SiteName,
		Subdomain:         order.Subdomain,
		PlanCode:          order.PlanCode,
		Region:            order.Region,
		Status:            "pending",
		SiteURL:           siteURL,
		AdminURL:          adminURL,
		AdminName:         order.AdminName,
		AdminEmail:        order.AdminEmail,
		MoodleUsername:    "admin",
		ProvisioningStep:  "pending",
		UsersActiveLimit:  plan.UsersActiveLimit,
		StorageBytesLimit: plan.StorageBytesLimit,
		WebCPUMillicores:  plan.WebCPUMillicores,
		WebMemoryMiB:      plan.WebMemoryMiB,
		CronCPUMillicores: plan.CronCPUMillicores,
		CronMemoryMiB:     plan.CronMemoryMiB,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO sites (
			id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url,
			admin_name, admin_email, moodle_username, provisioning_step, users_active_limit,
			storage_bytes_limit, web_cpu_millicores, web_memory_mib, cron_cpu_millicores,
			cron_memory_mib, report_bootstrap_token, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, '', $20, $21)
	`, site.ID, site.OwnerUserID, site.Name, site.Subdomain, site.PlanCode, site.Region, site.Status, site.SiteURL, site.AdminURL, site.AdminName, site.AdminEmail, site.MoodleUsername, site.ProvisioningStep, site.UsersActiveLimit, site.StorageBytesLimit, site.WebCPUMillicores, site.WebMemoryMiB, site.CronCPUMillicores, site.CronMemoryMiB, site.CreatedAt, site.UpdatedAt); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert site from checkout order: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO site_usage_snapshots (
			site_id, users_active_count, files_bytes_used, database_bytes_used, storage_bytes_used,
			warning_level, over_limit, last_error, measured_at, created_at, updated_at
		)
		VALUES ($1, 0, 0, 0, 0, 'normal', FALSE, '', NULL, $2, $2)
	`, site.ID, now); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert site usage snapshot from checkout order: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO site_backup_settings (site_id, enabled, frequency, retention_days, created_at, updated_at)
		VALUES ($1, TRUE, 'daily', 30, $2, $2)
	`, site.ID, now); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert site backup settings from checkout order: %w", err)
	}

	job := ProvisioningJob{
		ID:          uuid.New(),
		SiteID:      site.ID,
		RuntimeMode: runtimeMode,
		Status:      "pending",
		CurrentStep: "pending",
		Percent:     0,
		LastError:   "",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO provisioning_jobs (id, site_id, runtime_mode, status, current_step, percent, last_error, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, job.ID, job.SiteID, job.RuntimeMode, job.Status, job.CurrentStep, job.Percent, job.LastError, job.CreatedAt, job.UpdatedAt); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert provisioning job from checkout order: %w", err)
	}

	events := defaultProvisioningEvents(job.ID, now)
	for _, event := range events {
		if _, err := tx.Exec(ctx, `
			INSERT INTO provisioning_events (id, job_id, step_id, title, description, status, position, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, event.ID, event.JobID, event.StepID, event.Title, event.Description, event.Status, event.Position, event.CreatedAt, event.UpdatedAt); err != nil {
			return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("insert provisioning event from checkout order: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE invoices
		SET site_id = $2, site_name = $3, site_subdomain = $4, updated_at = $5
		WHERE id = $1
	`, invoiceID, site.ID, site.Name, site.Subdomain, now); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("link checkout invoice to site: %w", err)
	}

	if err := scanSiteCheckoutOrder(tx.QueryRow(ctx, fmt.Sprintf(`
		UPDATE site_checkout_orders
		SET
			status = 'provisioning',
			created_site_id = $2,
			provisioning_started_at = COALESCE(provisioning_started_at, $3),
			updated_at = $3
		WHERE invoice_id = $1
		RETURNING %s
	`, siteCheckoutOrderSelectColumns), invoiceID, site.ID, now), &order); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("update site checkout order provisioning: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return SiteCheckoutOrder{}, Site{}, ProvisioningJob{}, nil, fmt.Errorf("commit create site from checkout order tx: %w", err)
	}
	return order, site, job, events, nil
}

func (s *Store) CompleteSiteCheckoutOrderBySiteID(ctx context.Context, siteID uuid.UUID, completedAt time.Time) error {
	if _, err := s.pool.Exec(ctx, `
		UPDATE site_checkout_orders
		SET
			status = 'completed',
			completed_at = COALESCE(completed_at, $2),
			updated_at = $2
		WHERE created_site_id = $1
			AND status = 'provisioning'
	`, siteID, completedAt.UTC()); err != nil {
		return fmt.Errorf("complete site checkout order by site: %w", err)
	}
	return nil
}

func (s *Store) CompleteProvisionedSiteCheckoutOrders(ctx context.Context, completedAt time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE site_checkout_orders AS sco
		SET
			status = 'completed',
			completed_at = COALESCE(sco.completed_at, $1),
			updated_at = $1
		FROM sites AS s
		WHERE sco.created_site_id = s.id
			AND sco.status = 'provisioning'
			AND s.status = 'active'
	`, completedAt.UTC())
	if err != nil {
		return 0, fmt.Errorf("complete provisioned site checkout orders: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (s *Store) ExpireStaleSiteCheckoutOrders(ctx context.Context, now time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE site_checkout_orders
		SET status = 'expired', canceled_at = COALESCE(canceled_at, $1), updated_at = $1
		WHERE status IN ('pending_payment', 'paid')
			AND expires_at IS NOT NULL
			AND expires_at <= $1
	`, now.UTC())
	if err != nil {
		return 0, fmt.Errorf("expire stale site checkout orders: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (s *Store) CreateProviderWebhookEvent(ctx context.Context, params CreateProviderWebhookEventParams) (ProviderWebhookEvent, bool, error) {
	now := time.Now().UTC()
	event := ProviderWebhookEvent{
		ID:         uuid.New(),
		Provider:   strings.TrimSpace(params.Provider),
		ExternalID: strings.TrimSpace(params.ExternalID),
		EventType:  strings.TrimSpace(params.EventType),
		Signature:  strings.TrimSpace(params.Signature),
		Payload:    normalizeJSON(params.Payload),
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	err := s.pool.QueryRow(ctx, `
		INSERT INTO provider_webhook_events (
			id, provider, external_id, event_type, signature, payload, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
		RETURNING id, provider, external_id, event_type, signature, payload, processed_at, processing_error, created_at, updated_at
	`, event.ID, event.Provider, event.ExternalID, event.EventType, event.Signature, event.Payload, event.CreatedAt).Scan(
		&event.ID,
		&event.Provider,
		&event.ExternalID,
		&event.EventType,
		&event.Signature,
		&event.Payload,
		&event.ProcessedAt,
		&event.ProcessingError,
		&event.CreatedAt,
		&event.UpdatedAt,
	)
	if err == nil {
		return event, true, nil
	}
	if strings.Contains(err.Error(), "provider_webhook_events_provider_external_type_idx") {
		err = s.pool.QueryRow(ctx, `
			SELECT id, provider, external_id, event_type, signature, payload, processed_at, processing_error, created_at, updated_at
			FROM provider_webhook_events
			WHERE provider = $1 AND external_id = $2 AND event_type = $3
		`, event.Provider, event.ExternalID, event.EventType).Scan(
			&event.ID,
			&event.Provider,
			&event.ExternalID,
			&event.EventType,
			&event.Signature,
			&event.Payload,
			&event.ProcessedAt,
			&event.ProcessingError,
			&event.CreatedAt,
			&event.UpdatedAt,
		)
		if err != nil {
			return ProviderWebhookEvent{}, false, fmt.Errorf("lookup duplicate provider webhook event: %w", err)
		}
		return event, false, nil
	}
	return ProviderWebhookEvent{}, false, fmt.Errorf("create provider webhook event: %w", err)
}

func (s *Store) MarkProviderWebhookEventProcessed(ctx context.Context, eventID uuid.UUID, processingError string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE provider_webhook_events
		SET processed_at = $2, processing_error = $3, updated_at = $2
		WHERE id = $1
	`, eventID, time.Now().UTC(), strings.TrimSpace(processingError))
	if err != nil {
		return fmt.Errorf("mark provider webhook event processed: %w", err)
	}
	return nil
}

func (s *Store) ListPendingInvoiceCandidates(ctx context.Context, olderThan time.Duration) ([]PendingInvoiceCandidate, error) {
	cutoff := time.Now().UTC().Add(-olderThan)
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT
			%s,
			%s
		FROM invoices i
		JOIN payment_attempts p ON p.invoice_id = i.id
		WHERE i.status = 'pending'
			AND i.created_at <= $1
		ORDER BY i.created_at ASC
	`, invoiceSelectColumns, paymentAttemptSelectColumns), cutoff)
	if err != nil {
		return nil, fmt.Errorf("list pending invoice candidates: %w", err)
	}
	defer rows.Close()

	items := make([]PendingInvoiceCandidate, 0)
	for rows.Next() {
		var item PendingInvoiceCandidate
		var siteID uuid.NullUUID
		if err := rows.Scan(
			&item.Invoice.ID,
			&item.Invoice.OwnerUserID,
			&item.Invoice.CustomerID,
			&siteID,
			&item.Invoice.SiteName,
			&item.Invoice.SiteSubdomain,
			&item.Invoice.SubscriptionID,
			&item.Invoice.Number,
			&item.Invoice.Provider,
			&item.Invoice.ExternalID,
			&item.Invoice.Description,
			&item.Invoice.Status,
			&item.Invoice.Currency,
			&item.Invoice.BillingCycle,
			&item.Invoice.FromPlanCode,
			&item.Invoice.ToPlanCode,
			&item.Invoice.PaymentMethodType,
			&item.Invoice.AmountSubtotal,
			&item.Invoice.AmountTax,
			&item.Invoice.AmountTotal,
			&item.Invoice.CheckoutURL,
			&item.Invoice.RedirectURL,
			&item.Invoice.ExpiresAt,
			&item.Invoice.PaidAt,
			&item.Invoice.CanceledAt,
			&item.Invoice.FailedAt,
			&item.Invoice.CreatedAt,
			&item.Invoice.UpdatedAt,
			&item.Attempt.ID,
			&item.Attempt.InvoiceID,
			&item.Attempt.SubscriptionID,
			&item.Attempt.Provider,
			&item.Attempt.ExternalID,
			&item.Attempt.PaymentMethodType,
			&item.Attempt.Status,
			&item.Attempt.Amount,
			&item.Attempt.RedirectURL,
			&item.Attempt.FailureReason,
			&item.Attempt.RawResponse,
			&item.Attempt.ExpiresAt,
			&item.Attempt.PaidAt,
			&item.Attempt.CreatedAt,
			&item.Attempt.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan pending invoice candidate: %w", err)
		}
		if siteID.Valid {
			item.Invoice.SiteID = &siteID.UUID
		} else {
			item.Invoice.SiteID = nil
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) ExpireStalePendingInvoices(ctx context.Context, now time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE invoices
		SET status = 'expired', failed_at = COALESCE(failed_at, $1), updated_at = $1
		WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= $1
	`, now)
	if err != nil {
		return 0, fmt.Errorf("expire stale pending invoices: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `
		UPDATE payment_attempts
		SET status = 'expired', updated_at = $1
		WHERE invoice_id IN (
			SELECT id FROM invoices WHERE status = 'expired' AND expires_at IS NOT NULL AND expires_at <= $1
		)
	`, now); err != nil {
		return 0, fmt.Errorf("expire stale payment attempts: %w", err)
	}
	return tag.RowsAffected(), nil
}

func getSiteByID(ctx context.Context, tx pgx.Tx, siteID uuid.UUID) (Site, error) {
	var site Site
	err := tx.QueryRow(ctx, `
		SELECT
			id, owner_user_id, name, subdomain, plan_code, region, status, site_url, admin_url,
			admin_name, admin_email, moodle_username, provisioning_step, last_error,
			users_active_limit, storage_bytes_limit, web_cpu_millicores, web_memory_mib,
			cron_cpu_millicores, cron_memory_mib, activated_at, created_at, updated_at
		FROM sites
		WHERE id = $1
	`, siteID).Scan(
		&site.ID, &site.OwnerUserID, &site.Name, &site.Subdomain, &site.PlanCode, &site.Region, &site.Status, &site.SiteURL, &site.AdminURL,
		&site.AdminName, &site.AdminEmail, &site.MoodleUsername, &site.ProvisioningStep, &site.LastError,
		&site.UsersActiveLimit, &site.StorageBytesLimit, &site.WebCPUMillicores, &site.WebMemoryMiB,
		&site.CronCPUMillicores, &site.CronMemoryMiB, &site.ActivatedAt, &site.CreatedAt, &site.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Site{}, ErrNotFound
		}
		return Site{}, fmt.Errorf("get site by id tx: %w", err)
	}
	return site, nil
}

func getProvisioningBundleBySiteID(ctx context.Context, tx pgx.Tx, siteID uuid.UUID) (ProvisioningJob, []ProvisioningEvent, error) {
	var job ProvisioningJob
	if err := tx.QueryRow(ctx, `
		SELECT id, site_id, runtime_mode, status, current_step, percent, last_error, created_at, updated_at
		FROM provisioning_jobs
		WHERE site_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, siteID).Scan(
		&job.ID, &job.SiteID, &job.RuntimeMode, &job.Status, &job.CurrentStep, &job.Percent, &job.LastError, &job.CreatedAt, &job.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ProvisioningJob{}, nil, ErrNotFound
		}
		return ProvisioningJob{}, nil, fmt.Errorf("get provisioning job by site id: %w", err)
	}

	rows, err := tx.Query(ctx, `
		SELECT id, job_id, step_id, title, description, status, position, created_at, updated_at
		FROM provisioning_events
		WHERE job_id = $1
		ORDER BY position ASC, created_at ASC
	`, job.ID)
	if err != nil {
		return ProvisioningJob{}, nil, fmt.Errorf("list provisioning events by site id: %w", err)
	}
	defer rows.Close()

	events := make([]ProvisioningEvent, 0)
	for rows.Next() {
		var event ProvisioningEvent
		if err := rows.Scan(
			&event.ID, &event.JobID, &event.StepID, &event.Title, &event.Description, &event.Status, &event.Position, &event.CreatedAt, &event.UpdatedAt,
		); err != nil {
			return ProvisioningJob{}, nil, fmt.Errorf("scan provisioning event by site id: %w", err)
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return ProvisioningJob{}, nil, err
	}

	return job, events, nil
}

func getPlanByCodeTx(ctx context.Context, tx pgx.Tx, code string) (Plan, error) {
	var plan Plan
	err := tx.QueryRow(ctx, `
		SELECT code, name, description, price_monthly, price_yearly, features, users_active_limit, storage_bytes_limit,
			web_cpu_millicores, web_memory_mib, cron_cpu_millicores, cron_memory_mib, created_at, updated_at
		FROM plans
		WHERE code = $1
	`, strings.TrimSpace(code)).Scan(
		&plan.Code,
		&plan.Name,
		&plan.Description,
		&plan.PriceMonthly,
		&plan.PriceYearly,
		&plan.Features,
		&plan.UsersActiveLimit,
		&plan.StorageBytesLimit,
		&plan.WebCPUMillicores,
		&plan.WebMemoryMiB,
		&plan.CronCPUMillicores,
		&plan.CronMemoryMiB,
		&plan.CreatedAt,
		&plan.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Plan{}, ErrNotFound
		}
		return Plan{}, fmt.Errorf("get plan by code tx: %w", err)
	}
	return plan, nil
}
