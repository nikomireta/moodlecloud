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
	ID                uuid.UUID  `json:"id"`
	OwnerUserID       uuid.UUID  `json:"owner_user_id"`
	Name              string     `json:"name"`
	Subdomain         string     `json:"subdomain"`
	PlanCode          string     `json:"plan_code"`
	Region            string     `json:"region"`
	Status            string     `json:"status"`
	SiteURL           string     `json:"site_url"`
	AdminURL          string     `json:"admin_url"`
	AdminName         string     `json:"admin_name"`
	AdminEmail        string     `json:"admin_email"`
	MoodleUsername    string     `json:"moodle_username"`
	ProvisioningStep  string     `json:"provisioning_step"`
	LastError         string     `json:"last_error"`
	UsersActiveLimit  int        `json:"users_active_limit"`
	StorageBytesLimit int64      `json:"storage_bytes_limit"`
	WebCPUMillicores  int        `json:"web_cpu_millicores"`
	WebMemoryMiB      int        `json:"web_memory_mib"`
	CronCPUMillicores int        `json:"cron_cpu_millicores"`
	CronMemoryMiB     int        `json:"cron_memory_mib"`
	ActivatedAt       *time.Time `json:"activated_at,omitempty"`
	RuntimeHealth     string     `json:"runtime_health,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type SiteRuntimeMetadata struct {
	SiteID              uuid.UUID  `json:"site_id"`
	ImageRepository     string     `json:"image_repository"`
	ImageTag            string     `json:"image_tag"`
	WebContainerName    string     `json:"web_container_name"`
	CronContainerName   string     `json:"cron_container_name"`
	VolumeName          string     `json:"volume_name"`
	DatabaseName        string     `json:"database_name"`
	DatabaseUser        string     `json:"database_user"`
	HealthStatus        string     `json:"health_status"`
	LastHealthError     string     `json:"last_health_error"`
	LastHealthCheckedAt *time.Time `json:"last_health_checked_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
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
	OwnerUserID uuid.UUID
	Name        string
	Subdomain   string
	PlanCode    string
	Region      string
	AdminName   string
	AdminEmail  string
	SiteURL     string
	AdminURL    string
}

type UpdateSiteParams struct {
	OwnerUserID uuid.UUID
	SiteID      uuid.UUID
	Name        string
}

type UpdateSiteURLsParams struct {
	OwnerUserID uuid.UUID
	SiteID      uuid.UUID
	SiteURL     string
	AdminURL    string
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
	SiteID            uuid.UUID
	ImageRepository   string
	ImageTag          string
	WebContainerName  string
	CronContainerName string
	VolumeName        string
	DatabaseName      string
	DatabaseUser      string
	HealthStatus      string
	LastHealthError   string
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
