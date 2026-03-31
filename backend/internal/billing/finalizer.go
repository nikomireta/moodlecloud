package billing

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"moodlepilot/backend/internal/provisioning"
	"moodlepilot/backend/internal/store"
)

type Finalizer struct {
	Store              *store.Store
	AsynqClient        *asynq.Client
	Runtime            provisioning.Runtime
	RuntimeMode        string
	HostCapacityPolicy store.HostCapacityPolicy
	SiteURLBuilder     func(string) (string, string)
}

func (f Finalizer) FinalizePaidInvoice(ctx context.Context, invoice store.Invoice, response ChargeResponse) error {
	if f.Store == nil {
		return fmt.Errorf("billing finalizer membutuhkan store")
	}

	paidAt := time.Now().UTC()
	if response.PaidAt != nil {
		paidAt = response.PaidAt.UTC()
	} else if invoice.PaidAt != nil {
		paidAt = invoice.PaidAt.UTC()
	}

	var (
		paymentMethodID *uuid.UUID
		collectionMethod = "manual_invoice"
	)
	if invoice.PaymentMethodType == "card" && strings.TrimSpace(response.SavedTokenID) != "" {
		method, err := f.Store.UpsertBillingPaymentMethod(ctx, store.UpsertBillingPaymentMethodParams{
			CustomerID:    invoice.CustomerID,
			OwnerUserID:   invoice.OwnerUserID,
			Provider:      response.Provider,
			ProviderToken: response.SavedTokenID,
			Type:          "card",
			Brand:         response.CardBrand,
			Last4:         maskLast4(response.MaskedCard),
			Status:        "active",
			Reusable:      true,
			IsDefault:     true,
			RawPayload:    response.Raw,
		})
		if err != nil {
			return err
		}
		paymentMethodID = &method.ID
		collectionMethod = "auto_charge"
	}

	siteID := invoice.SiteID
	siteName := invoice.SiteName
	siteSubdomain := invoice.SiteSubdomain
	isSiteCheckout := false

	if _, err := f.Store.MarkSiteCheckoutOrderPaid(ctx, invoice.ID, paidAt); err == nil {
		isSiteCheckout = true
		siteURL := ""
		adminURL := ""
		if f.SiteURLBuilder != nil {
			siteURL, adminURL = f.SiteURLBuilder(invoice.SiteSubdomain)
		}
		order, site, job, _, err := f.Store.CreateSiteFromCheckoutOrder(ctx, invoice.ID, f.RuntimeMode, f.HostCapacityPolicy, siteURL, adminURL)
		if err != nil {
			return err
		}
		siteID = &site.ID
		siteName = site.Name
		siteSubdomain = site.Subdomain
		if f.AsynqClient != nil {
			task, err := provisioning.NewProvisionSiteTask(job.ID)
			if err != nil {
				return err
			}
			if _, err := f.AsynqClient.Enqueue(
				task,
				asynq.Queue("default"),
				asynq.MaxRetry(5),
				asynq.Timeout(20*time.Minute),
				asynq.TaskID("provision-site-"+job.ID.String()),
			); err != nil {
				return fmt.Errorf("enqueue provisioning from billing: %w", err)
			}
		}
		log.Printf("billing: finalized site checkout invoice=%s order=%s site=%s", invoice.ID, order.ID, site.Subdomain)
	} else if !errors.Is(err, store.ErrNotFound) {
		return err
	}

	planCode := invoice.ToPlanCode
	if planCode == "" {
		planCode = invoice.FromPlanCode
	}

	if invoice.SubscriptionID == nil && siteID != nil && planCode != "" {
		periodEnd := PeriodEnd(paidAt, invoice.BillingCycle)
		if _, err := f.Store.UpsertSubscription(ctx, store.UpsertSubscriptionParams{
			CustomerID:         invoice.CustomerID,
			OwnerUserID:        invoice.OwnerUserID,
			SiteID:             siteID,
			SiteName:           siteName,
			SiteSubdomain:      siteSubdomain,
			PaymentMethodID:    paymentMethodID,
			Provider:           response.Provider,
			Status:             "active",
			BillingCycle:       invoice.BillingCycle,
			CollectionMethod:   collectionMethod,
			CurrentPlanCode:    planCode,
			PendingPlanCode:    "",
			Currency:           invoice.Currency,
			AmountTotal:        invoice.AmountTotal,
			AnchorAt:           &paidAt,
			CurrentPeriodStart: &paidAt,
			CurrentPeriodEnd:   &periodEnd,
			NextChargeAt:       &periodEnd,
			LastError:          "",
		}); err != nil {
			return err
		}
	}

	if invoice.SubscriptionID != nil {
		periodEnd := PeriodEnd(paidAt, invoice.BillingCycle)
		if _, err := f.Store.AdvanceSubscriptionAfterRenewal(ctx, *invoice.SubscriptionID, invoice.ID, paidAt, periodEnd); err != nil && !errors.Is(err, store.ErrNotFound) {
			return err
		}
	}

	if isSiteCheckout || invoice.SiteID == nil || invoice.ToPlanCode == "" || invoice.FromPlanCode == invoice.ToPlanCode {
		return nil
	}

	currentSite, err := f.Store.GetSiteByIDForOwner(ctx, invoice.OwnerUserID, *invoice.SiteID)
	if err != nil {
		return err
	}
	if currentSite.PlanCode == invoice.ToPlanCode {
		return nil
	}

	targetPlan, err := f.Store.GetPlanByCode(ctx, invoice.ToPlanCode)
	if err != nil {
		return err
	}
	if _, _, err := f.applySitePlanChange(ctx, invoice.OwnerUserID, currentSite, targetPlan); err != nil {
		return err
	}
	if _, auditErr := f.Store.CreateSitePlanChange(ctx, store.CreateSitePlanChangeParams{
		SiteID:        invoice.SiteID,
		SiteName:      currentSite.Name,
		SiteSubdomain: currentSite.Subdomain,
		OwnerUserID:   invoice.OwnerUserID,
		FromPlanCode:  invoice.FromPlanCode,
		ToPlanCode:    invoice.ToPlanCode,
		Status:        "applied",
		AppliedAt:     paidAt,
	}); auditErr != nil {
		log.Printf("billing: site plan change audit failed site_id=%s: %v", invoice.SiteID, auditErr)
	}

	return nil
}

func (f Finalizer) applySitePlanChange(ctx context.Context, ownerUserID uuid.UUID, currentSite store.Site, targetPlan store.Plan) (store.Site, *store.SiteUsageSnapshot, error) {
	if f.Runtime == nil {
		return store.Site{}, nil, fmt.Errorf("runtime billing belum siap untuk upgrade paket")
	}

	provisioningStatus, err := f.Store.GetProvisioningStatusBySiteID(ctx, ownerUserID, currentSite.ID)
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
	domain, err := f.Store.GetSiteCustomDomain(ctx, currentSite.ID)
	if err == nil {
		customDomain = &domain
	} else if !errors.Is(err, store.ErrNotFound) {
		return store.Site{}, nil, err
	}

	updatedSite, updatedUsage, err := f.Store.UpdateSitePlan(ctx, store.UpdateSitePlanParams{
		OwnerUserID: ownerUserID,
		SiteID:      currentSite.ID,
		PlanCode:    targetPlan.Code,
	}, targetPlan, f.HostCapacityPolicy)
	if err != nil {
		return store.Site{}, nil, err
	}

	if _, err := f.Runtime.ReconcileSite(ctx, updatedSite, provisioningStatus.Job, provisioningStatus.Runtime, customDomain); err != nil {
		rollbackSite, rollbackUsage, rollbackErr := f.Store.UpdateSitePlan(ctx, store.UpdateSitePlanParams{
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
		}, f.HostCapacityPolicy)
		if rollbackErr == nil {
			if _, runtimeRollbackErr := f.Runtime.ReconcileSite(ctx, rollbackSite, provisioningStatus.Job, provisioningStatus.Runtime, customDomain); runtimeRollbackErr != nil {
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
