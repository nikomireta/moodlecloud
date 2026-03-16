package store

import (
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
	Code         string                 `json:"code"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	PriceMonthly *int64                 `json:"price_monthly"`
	PriceYearly  *int64                 `json:"price_yearly"`
	Features     map[string]interface{} `json:"features"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

type Site struct {
	ID               uuid.UUID  `json:"id"`
	OwnerUserID      uuid.UUID  `json:"owner_user_id"`
	Name             string     `json:"name"`
	Subdomain        string     `json:"subdomain"`
	PlanCode         string     `json:"plan_code"`
	Region           string     `json:"region"`
	Status           string     `json:"status"`
	SiteURL          string     `json:"site_url"`
	AdminURL         string     `json:"admin_url"`
	AdminName        string     `json:"admin_name"`
	AdminEmail       string     `json:"admin_email"`
	MoodleUsername   string     `json:"moodle_username"`
	ProvisioningStep string     `json:"provisioning_step"`
	LastError        string     `json:"last_error"`
	ActivatedAt      *time.Time `json:"activated_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
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

type CreateNotificationParams struct {
	UserID    uuid.UUID
	Type      string
	Category  string
	Title     string
	Message   string
	ActionURL string
}
