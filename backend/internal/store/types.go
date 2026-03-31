package store

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID              uuid.UUID  `json:"id"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	Company         string     `json:"company"`
	Organization    string     `json:"organization"`
	Phone           string     `json:"phone"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type AuthUser struct {
	User
	PasswordHash string
}

type Session struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	UserAgent  string    `json:"user_agent"`
	IPAddress  string    `json:"ip_address"`
	RememberMe bool      `json:"remember_me"`
	ExpiresAt  time.Time `json:"expires_at"`
	LastSeenAt time.Time `json:"last_seen_at"`
	CreatedAt  time.Time `json:"created_at"`
}

type SessionLookup struct {
	Session
	SecretHash string
	User       User
}

type Plan struct {
	Code              string                 `json:"code"`
	Name              string                 `json:"name"`
	Description       string                 `json:"description"`
	PriceMonthly      *int64                 `json:"price_monthly"`
	PriceYearly       *int64                 `json:"price_yearly"`
	Features          map[string]interface{} `json:"features"`
	UsersActiveLimit  int                    `json:"users_active_limit"`
	StorageBytesLimit int64                  `json:"storage_bytes_limit"`
	WebCPUMillicores  int                    `json:"web_cpu_millicores"`
	WebMemoryMiB      int                    `json:"web_memory_mib"`
	CronCPUMillicores int                    `json:"cron_cpu_millicores"`
	CronMemoryMiB     int                    `json:"cron_memory_mib"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}

type Site struct {
	ID                   uuid.UUID          `json:"id"`
	OwnerUserID          uuid.UUID          `json:"owner_user_id"`
	Name                 string             `json:"name"`
	Subdomain            string             `json:"subdomain"`
	PlanCode             string             `json:"plan_code"`
	Region               string             `json:"region"`
	Status               string             `json:"status"`
	SiteURL              string             `json:"site_url"`
	AdminURL             string             `json:"admin_url"`
	AdminName            string             `json:"admin_name"`
	AdminEmail           string             `json:"admin_email"`
	MoodleUsername       string             `json:"moodle_username"`
	ProvisioningStep     string             `json:"provisioning_step"`
	LastError            string             `json:"last_error"`
	UsersActiveLimit     int                `json:"users_active_limit"`
	StorageBytesLimit    int64              `json:"storage_bytes_limit"`
	WebCPUMillicores     int                `json:"web_cpu_millicores"`
	WebMemoryMiB         int                `json:"web_memory_mib"`
	CronCPUMillicores    int                `json:"cron_cpu_millicores"`
	CronMemoryMiB        int                `json:"cron_memory_mib"`
	ActivatedAt          *time.Time         `json:"activated_at,omitempty"`
	RuntimeHealth        string             `json:"runtime_health,omitempty"`
	RuntimeLastError     string             `json:"runtime_last_error,omitempty"`
	Usage                *SiteUsageSnapshot `json:"usage,omitempty"`
	ReportBootstrapToken string             `json:"-"`
	CreatedAt            time.Time          `json:"created_at"`
	UpdatedAt            time.Time          `json:"updated_at"`
}

type SiteRuntimeMetadata struct {
	SiteID               uuid.UUID  `json:"site_id"`
	ImageRepository      string     `json:"image_repository"`
	ImageTag             string     `json:"image_tag"`
	WebContainerName     string     `json:"web_container_name"`
	CronContainerName    string     `json:"cron_container_name"`
	VolumeName           string     `json:"volume_name"`
	DatabaseName         string     `json:"database_name"`
	DatabaseUser         string     `json:"database_user"`
	HealthStatus         string     `json:"health_status"`
	LastHealthError      string     `json:"last_health_error"`
	ReportBootstrapToken string     `json:"-"`
	LastHealthCheckedAt  *time.Time `json:"last_health_checked_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type SiteCustomDomain struct {
	SiteID            uuid.UUID  `json:"site_id"`
	Domain            string     `json:"domain"`
	Status            string     `json:"status"`
	VerificationToken string     `json:"-"`
	LastError         string     `json:"last_error"`
	VerifiedAt        *time.Time `json:"verified_at,omitempty"`
	ActivatedAt       *time.Time `json:"activated_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type ProvisioningJob struct {
	ID          uuid.UUID `json:"job_id"`
	SiteID      uuid.UUID `json:"site_id"`
	RuntimeMode string    `json:"runtime_mode"`
	Status      string    `json:"status"`
	CurrentStep string    `json:"current_step"`
	Percent     int       `json:"percent"`
	LastError   string    `json:"last_error"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProvisioningEvent struct {
	ID          uuid.UUID `json:"id"`
	JobID       uuid.UUID `json:"job_id"`
	StepID      string    `json:"step_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProvisioningStatus struct {
	Site    Site                 `json:"site"`
	Job     ProvisioningJob      `json:"job"`
	Runtime *SiteRuntimeMetadata `json:"runtime,omitempty"`
	Events  []ProvisioningEvent  `json:"steps"`
}

type SiteProvisioningContext struct {
	Site    Site
	Job     ProvisioningJob
	Runtime *SiteRuntimeMetadata
}

type SiteUsageSnapshot struct {
	SiteID            uuid.UUID  `json:"site_id"`
	UsersActiveCount  int        `json:"users_active_count"`
	FilesBytesUsed    int64      `json:"files_bytes_used"`
	DatabaseBytesUsed int64      `json:"database_bytes_used"`
	StorageBytesUsed  int64      `json:"storage_bytes_used"`
	WarningLevel      string     `json:"warning_level"`
	OverLimit         bool       `json:"over_limit"`
	LastError         string     `json:"last_error"`
	MeasuredAt        *time.Time `json:"measured_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type SitePlanChange struct {
	ID            uuid.UUID  `json:"id"`
	SiteID        *uuid.UUID `json:"site_id,omitempty"`
	SiteName      string     `json:"site_name"`
	SiteSubdomain string     `json:"site_subdomain"`
	OwnerUserID   uuid.UUID  `json:"owner_user_id"`
	FromPlanCode  string     `json:"from_plan_code"`
	ToPlanCode    string     `json:"to_plan_code"`
	Status        string     `json:"status"`
	AppliedAt     time.Time  `json:"applied_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

type BillingCustomer struct {
	ID                 uuid.UUID `json:"id"`
	UserID             uuid.UUID `json:"user_id"`
	Provider           string    `json:"provider"`
	ProviderCustomerID string    `json:"provider_customer_id"`
	FullName           string    `json:"full_name"`
	Email              string    `json:"email"`
	Phone              string    `json:"phone"`
	Organization       string    `json:"organization"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type BillingPaymentMethod struct {
	ID            uuid.UUID       `json:"id"`
	CustomerID    uuid.UUID       `json:"customer_id"`
	OwnerUserID   uuid.UUID       `json:"owner_user_id"`
	Provider      string          `json:"provider"`
	ProviderToken string          `json:"provider_token"`
	Type          string          `json:"type"`
	Brand         string          `json:"brand"`
	Last4         string          `json:"last4"`
	ExpiryMonth   string          `json:"expiry_month"`
	ExpiryYear    string          `json:"expiry_year"`
	Status        string          `json:"status"`
	Reusable      bool            `json:"reusable"`
	IsDefault     bool            `json:"is_default"`
	RawPayload    json.RawMessage `json:"raw_payload,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type Subscription struct {
	ID                     uuid.UUID  `json:"id"`
	CustomerID             uuid.UUID  `json:"customer_id"`
	OwnerUserID            uuid.UUID  `json:"owner_user_id"`
	SiteID                 *uuid.UUID `json:"site_id,omitempty"`
	SiteName               string     `json:"site_name"`
	SiteSubdomain          string     `json:"site_subdomain"`
	PaymentMethodID        *uuid.UUID `json:"payment_method_id,omitempty"`
	Provider               string     `json:"provider"`
	ProviderSubscriptionID string   `json:"provider_subscription_id"`
	Status                 string     `json:"status"`
	BillingCycle           string     `json:"billing_cycle"`
	CollectionMethod       string     `json:"collection_method"`
	CurrentPlanCode        string     `json:"current_plan_code"`
	PendingPlanCode        string     `json:"pending_plan_code"`
	Currency               string     `json:"currency"`
	AmountTotal            int64      `json:"amount_total"`
	AnchorAt               *time.Time `json:"anchor_at,omitempty"`
	CurrentPeriodStart     *time.Time `json:"current_period_start,omitempty"`
	CurrentPeriodEnd       *time.Time `json:"current_period_end,omitempty"`
	NextChargeAt           *time.Time `json:"next_charge_at,omitempty"`
	LastChargeFailedAt     *time.Time `json:"last_charge_failed_at,omitempty"`
	LastError              string     `json:"last_error"`
	CanceledAt             *time.Time `json:"canceled_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

type Invoice struct {
	ID                uuid.UUID  `json:"id"`
	OwnerUserID       uuid.UUID  `json:"owner_user_id"`
	CustomerID        uuid.UUID  `json:"customer_id"`
	SiteID            *uuid.UUID `json:"site_id,omitempty"`
	SiteName          string     `json:"site_name"`
	SiteSubdomain     string     `json:"site_subdomain"`
	SubscriptionID    *uuid.UUID `json:"subscription_id,omitempty"`
	Number            string     `json:"number"`
	Provider          string     `json:"provider"`
	ExternalID        string     `json:"external_id"`
	Description       string     `json:"description"`
	Status            string     `json:"status"`
	Currency          string     `json:"currency"`
	BillingCycle      string     `json:"billing_cycle"`
	FromPlanCode      string     `json:"from_plan_code"`
	ToPlanCode        string     `json:"to_plan_code"`
	PaymentMethodType string     `json:"payment_method_type"`
	AmountSubtotal    int64      `json:"amount_subtotal"`
	AmountTax         int64      `json:"amount_tax"`
	AmountTotal       int64      `json:"amount_total"`
	CheckoutURL       string     `json:"checkout_url"`
	RedirectURL       string     `json:"redirect_url"`
	ExpiresAt         *time.Time `json:"expires_at,omitempty"`
	PaidAt            *time.Time `json:"paid_at,omitempty"`
	CanceledAt        *time.Time `json:"canceled_at,omitempty"`
	FailedAt          *time.Time `json:"failed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type InvoiceItem struct {
	ID          uuid.UUID       `json:"id"`
	InvoiceID   uuid.UUID       `json:"invoice_id"`
	ItemType    string          `json:"item_type"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Quantity    int             `json:"quantity"`
	UnitAmount  int64           `json:"unit_amount"`
	TotalAmount int64           `json:"total_amount"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type PaymentAttempt struct {
	ID                uuid.UUID       `json:"id"`
	InvoiceID         uuid.UUID       `json:"invoice_id"`
	SubscriptionID    *uuid.UUID      `json:"subscription_id,omitempty"`
	Provider          string          `json:"provider"`
	ExternalID        string          `json:"external_id"`
	PaymentMethodType string          `json:"payment_method_type"`
	Status            string          `json:"status"`
	Amount            int64           `json:"amount"`
	RedirectURL       string          `json:"redirect_url"`
	FailureReason     string          `json:"failure_reason"`
	RawResponse       json.RawMessage `json:"raw_response,omitempty"`
	ExpiresAt         *time.Time      `json:"expires_at,omitempty"`
	PaidAt            *time.Time      `json:"paid_at,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

type ProviderWebhookEvent struct {
	ID              uuid.UUID       `json:"id"`
	Provider        string          `json:"provider"`
	ExternalID      string          `json:"external_id"`
	EventType       string          `json:"event_type"`
	Signature       string          `json:"signature"`
	Payload         json.RawMessage `json:"payload"`
	ProcessedAt     *time.Time      `json:"processed_at,omitempty"`
	ProcessingError string          `json:"processing_error"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type BillingOverview struct {
	Sites           []Site                 `json:"sites"`
	Changes         []SitePlanChange       `json:"changes"`
	Invoices        []Invoice              `json:"invoices"`
	PaymentMethods  []BillingPaymentMethod `json:"payment_methods"`
	Subscriptions   []Subscription         `json:"subscriptions"`
}

type SiteCheckoutOrder struct {
	ID                    uuid.UUID  `json:"id"`
	OwnerUserID           uuid.UUID  `json:"owner_user_id"`
	InvoiceID             uuid.UUID  `json:"invoice_id"`
	CreatedSiteID         *uuid.UUID `json:"created_site_id,omitempty"`
	Status                string     `json:"status"`
	SiteName              string     `json:"site_name"`
	Subdomain             string     `json:"subdomain"`
	PlanCode              string     `json:"plan_code"`
	BillingCycle          string     `json:"billing_cycle"`
	Region                string     `json:"region"`
	AdminName             string     `json:"admin_name"`
	AdminEmail            string     `json:"admin_email"`
	PaymentMethodType     string     `json:"payment_method_type"`
	AmountTotal           int64      `json:"amount_total"`
	UsersActiveLimit      int        `json:"users_active_limit"`
	StorageBytesLimit     int64      `json:"storage_bytes_limit"`
	WebCPUMillicores      int        `json:"web_cpu_millicores"`
	WebMemoryMiB          int        `json:"web_memory_mib"`
	CronCPUMillicores     int        `json:"cron_cpu_millicores"`
	CronMemoryMiB         int        `json:"cron_memory_mib"`
	ExpiresAt             *time.Time `json:"expires_at,omitempty"`
	PaidAt                *time.Time `json:"paid_at,omitempty"`
	ProvisioningStartedAt *time.Time `json:"provisioning_started_at,omitempty"`
	CompletedAt           *time.Time `json:"completed_at,omitempty"`
	CanceledAt            *time.Time `json:"canceled_at,omitempty"`
	LastError             string     `json:"last_error"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type DueSubscriptionCandidate struct {
	Subscription  Subscription         `json:"subscription"`
	Customer      BillingCustomer      `json:"customer"`
	PaymentMethod BillingPaymentMethod `json:"payment_method"`
	Site          Site                 `json:"site"`
}

type PendingInvoiceCandidate struct {
	Invoice Invoice        `json:"invoice"`
	Attempt PaymentAttempt `json:"attempt"`
}

type SiteReportConnectToken struct {
	ID          uuid.UUID  `json:"id"`
	SiteID      uuid.UUID  `json:"site_id"`
	OwnerUserID uuid.UUID  `json:"owner_user_id"`
	TokenHash   string     `json:"-"`
	ExpiresAt   time.Time  `json:"expires_at"`
	UsedAt      *time.Time `json:"used_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type SiteAdminAccessToken struct {
	ID             uuid.UUID  `json:"id"`
	SiteID         uuid.UUID  `json:"site_id"`
	OwnerUserID    uuid.UUID  `json:"owner_user_id"`
	TargetUsername string     `json:"target_username"`
	TargetEmail    string     `json:"target_email"`
	TokenHash      string     `json:"-"`
	ExpiresAt      time.Time  `json:"expires_at"`
	UsedAt         *time.Time `json:"used_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type SiteBackupSettings struct {
	SiteID        uuid.UUID `json:"site_id"`
	Enabled       bool      `json:"enabled"`
	Frequency     string    `json:"frequency"`
	RetentionDays int       `json:"retention_days"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type SiteBackup struct {
	ID            uuid.UUID  `json:"id"`
	OwnerUserID   uuid.UUID  `json:"owner_user_id"`
	SiteID        *uuid.UUID `json:"site_id,omitempty"`
	SiteName      string     `json:"site_name"`
	SiteSubdomain string     `json:"site_subdomain"`
	Trigger       string     `json:"trigger"`
	Status        string     `json:"status"`
	ObjectKey     string     `json:"object_key"`
	SizeBytes     int64      `json:"size_bytes"`
	SHA256        string     `json:"sha256"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	LastError     string     `json:"last_error"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type SiteReportConnection struct {
	SiteID             uuid.UUID  `json:"site_id"`
	IngestTokenHash    string     `json:"-"`
	SiteURLSnapshot    string     `json:"site_url_snapshot"`
	PluginVersion      string     `json:"plugin_version"`
	MoodleVersion      string     `json:"moodle_version"`
	Capabilities       []string   `json:"capabilities"`
	TrackingMode       string     `json:"tracking_mode"`
	TrackingLastSeenAt *time.Time `json:"tracking_last_seen_at,omitempty"`
	LastError          string     `json:"last_error"`
	RegisteredAt       time.Time  `json:"registered_at"`
	LastSeenAt         time.Time  `json:"last_seen_at"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type SiteReportSnapshot struct {
	ID            uuid.UUID       `json:"id"`
	SiteID        uuid.UUID       `json:"site_id"`
	SnapshotKey   string          `json:"snapshot_key"`
	PeriodKey     string          `json:"period_key"`
	PeriodStart   time.Time       `json:"period_start"`
	PeriodEnd     time.Time       `json:"period_end"`
	Payload       json.RawMessage `json:"payload"`
	PluginVersion string          `json:"plugin_version"`
	MoodleVersion string          `json:"moodle_version"`
	GeneratedAt   time.Time       `json:"generated_at"`
	ReceivedAt    time.Time       `json:"received_at"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type Notification struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	Type      string     `json:"type"`
	Category  string     `json:"category"`
	Title     string     `json:"title"`
	Message   string     `json:"message"`
	ActionURL string     `json:"action_url"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type NotificationPreferences struct {
	Email map[string]bool `json:"email"`
	Push  map[string]bool `json:"push"`
}

type SeedPlaywrightUserParams struct {
	Name         string
	Email        string
	PasswordHash string
	Company      string
	Organization string
}

type CreateUserParams struct {
	Name         string
	Email        string
	Company      string
	Organization string
	Phone        string
	PasswordHash string
}

type CreateSessionParams struct {
	UserID     uuid.UUID
	SecretHash string
	UserAgent  string
	IPAddress  string
	RememberMe bool
	ExpiresAt  time.Time
}

type CreateSiteParams struct {
	OwnerUserID          uuid.UUID
	Name                 string
	Subdomain            string
	PlanCode             string
	Region               string
	AdminName            string
	AdminEmail           string
	SiteURL              string
	AdminURL             string
	ReportBootstrapToken string
}

type UpdateSiteParams struct {
	OwnerUserID uuid.UUID
	SiteID      uuid.UUID
	Name        string
}

type UpdateSitePlanParams struct {
	OwnerUserID uuid.UUID
	SiteID      uuid.UUID
	PlanCode    string
}

type UpdateSiteURLsParams struct {
	OwnerUserID uuid.UUID
	SiteID      uuid.UUID
	SiteURL     string
	AdminURL    string
}

type CreateSitePlanChangeParams struct {
	SiteID       *uuid.UUID
	SiteName     string
	SiteSubdomain string
	OwnerUserID  uuid.UUID
	FromPlanCode string
	ToPlanCode   string
	Status       string
	AppliedAt    time.Time
}

type CreateSiteAdminAccessTokenParams struct {
	SiteID         uuid.UUID
	OwnerUserID    uuid.UUID
	TargetUsername string
	TargetEmail    string
	TokenHash      string
	ExpiresAt      time.Time
}

type CreateSiteReportConnectTokenParams struct {
	SiteID      uuid.UUID
	OwnerUserID uuid.UUID
	TokenHash   string
	ExpiresAt   time.Time
}

type UpsertSiteReportConnectionParams struct {
	SiteID             uuid.UUID
	IngestTokenHash    string
	SiteURLSnapshot    string
	PluginVersion      string
	MoodleVersion      string
	Capabilities       []string
	TrackingMode       string
	TrackingLastSeenAt *time.Time
	LastError          string
}

type UpdateSiteReportConnectionHeartbeatParams struct {
	SiteID             uuid.UUID
	PluginVersion      string
	MoodleVersion      string
	TrackingMode       string
	TrackingLastSeenAt *time.Time
	LastError          string
	LastSeenAt         time.Time
}

type UpsertSiteReportSnapshotParams struct {
	SiteID        uuid.UUID
	SnapshotKey   string
	PeriodKey     string
	PeriodStart   time.Time
	PeriodEnd     time.Time
	Payload       json.RawMessage
	PluginVersion string
	MoodleVersion string
	GeneratedAt   time.Time
	ReceivedAt    time.Time
}

type HostCapacityPolicy struct {
	StorageBytesLimit  int64
	CPUMillicoresLimit int
	MemoryMiBLimit     int
}

type UpsertSiteRuntimeMetadataParams struct {
	SiteID               uuid.UUID
	ImageRepository      string
	ImageTag             string
	WebContainerName     string
	CronContainerName    string
	VolumeName           string
	DatabaseName         string
	DatabaseUser         string
	HealthStatus         string
	LastHealthError      string
	ReportBootstrapToken string
}

type UpsertSiteCustomDomainParams struct {
	SiteID            uuid.UUID
	Domain            string
	Status            string
	VerificationToken string
	LastError         string
	VerifiedAt        *time.Time
	ActivatedAt       *time.Time
}

type CreateSiteBackupParams struct {
	Site          Site
	Trigger       string
	RetentionDays int
}

type UpdateSiteBackupSettingsParams struct {
	OwnerUserID   uuid.UUID
	SiteID        uuid.UUID
	Enabled       bool
	Frequency     string
	RetentionDays int
}

type SiteBackupExecutionContext struct {
	Backup   SiteBackup
	Settings SiteBackupSettings
	Site     Site
	Job      ProvisioningJob
	Runtime  *SiteRuntimeMetadata
}

type SiteBackupScheduleCandidate struct {
	Site                   Site
	Job                    ProvisioningJob
	Runtime                *SiteRuntimeMetadata
	Settings               SiteBackupSettings
	LastSuccessfulBackupAt *time.Time
}

type CreateNotificationParams struct {
	UserID    uuid.UUID
	Type      string
	Category  string
	Title     string
	Message   string
	ActionURL string
}

type UpsertBillingCustomerParams struct {
	UserID             uuid.UUID
	Provider           string
	ProviderCustomerID string
	FullName           string
	Email              string
	Phone              string
	Organization       string
}

type CreateInvoiceWithAttemptParams struct {
	OwnerUserID        uuid.UUID
	CustomerID         uuid.UUID
	SiteID             *uuid.UUID
	SiteName           string
	SiteSubdomain      string
	SubscriptionID     *uuid.UUID
	Provider           string
	ExternalID         string
	Number             string
	Description        string
	Status             string
	Currency           string
	BillingCycle       string
	FromPlanCode       string
	ToPlanCode         string
	PaymentMethodType  string
	AmountSubtotal     int64
	AmountTax          int64
	AmountTotal        int64
	CheckoutURL        string
	RedirectURL        string
	ExpiresAt          *time.Time
	ItemType           string
	ItemName           string
	ItemDescription    string
	ItemQuantity       int
	ItemUnitAmount     int64
	ItemTotalAmount    int64
	ItemMetadata       json.RawMessage
	AttemptStatus      string
	AttemptRedirectURL string
	AttemptExpiresAt   *time.Time
	AttemptRawResponse json.RawMessage
}

type UpdateInvoicePaymentStateParams struct {
	InvoiceID          uuid.UUID
	Status             string
	CheckoutURL        string
	RedirectURL        string
	PaymentMethodType  string
	AttemptStatus      string
	AttemptRedirectURL string
	AttemptFailureReason string
	AttemptRawResponse json.RawMessage
	ExpiresAt          *time.Time
	PaidAt             *time.Time
	FailedAt           *time.Time
	CanceledAt         *time.Time
}

type UpsertBillingPaymentMethodParams struct {
	CustomerID    uuid.UUID
	OwnerUserID   uuid.UUID
	Provider      string
	ProviderToken string
	Type          string
	Brand         string
	Last4         string
	ExpiryMonth   string
	ExpiryYear    string
	Status        string
	Reusable      bool
	IsDefault     bool
	RawPayload    json.RawMessage
}

type UpsertSubscriptionParams struct {
	CustomerID             uuid.UUID
	OwnerUserID            uuid.UUID
	SiteID                 *uuid.UUID
	SiteName               string
	SiteSubdomain          string
	PaymentMethodID        *uuid.UUID
	Provider               string
	ProviderSubscriptionID string
	Status                 string
	BillingCycle           string
	CollectionMethod       string
	CurrentPlanCode        string
	PendingPlanCode        string
	Currency               string
	AmountTotal            int64
	AnchorAt               *time.Time
	CurrentPeriodStart     *time.Time
	CurrentPeriodEnd       *time.Time
	NextChargeAt           *time.Time
	LastChargeFailedAt     *time.Time
	LastError              string
	CanceledAt             *time.Time
}

type CreateSiteCheckoutOrderParams struct {
	OwnerUserID       uuid.UUID
	InvoiceID         uuid.UUID
	Status            string
	SiteName          string
	Subdomain         string
	PlanCode          string
	BillingCycle      string
	Region            string
	AdminName         string
	AdminEmail        string
	PaymentMethodType string
	AmountTotal       int64
	UsersActiveLimit  int
	StorageBytesLimit int64
	WebCPUMillicores  int
	WebMemoryMiB      int
	CronCPUMillicores int
	CronMemoryMiB     int
	ExpiresAt         *time.Time
}

type CreateProviderWebhookEventParams struct {
	Provider   string
	ExternalID string
	EventType  string
	Signature  string
	Payload    json.RawMessage
}
