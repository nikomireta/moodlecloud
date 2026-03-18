"use client"

export type AuthUser = {
  id: string
  name: string
  email: string
  company: string
  organization: string
  phone: string
  email_verified_at?: string | null
  created_at: string
  updated_at: string
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated"

export type RegisterRequest = {
  name: string
  email: string
  company: string
  password: string
  confirmPassword: string
}

export type VerifyEmailRequest = {
  email: string
  code: string
}

export type LoginRequest = {
  email: string
  password: string
  rememberMe: boolean
}

export type ForgotPasswordRequest = {
  email: string
}

export type ResetPasswordRequest = {
  token: string
  newPassword: string
}

export type UpdateProfileRequest = {
  name: string
  company: string
  organization: string
  phone: string
}

export type UpdatePasswordRequest = {
  currentPassword: string
  newPassword: string
}

export type SessionInfo = {
  id: string
  user_id: string
  user_agent: string
  ip_address: string
  remember_me: boolean
  expires_at: string
  last_seen_at: string
  created_at: string
}

export type NotificationPreferences = {
  email: Record<string, boolean>
  push: Record<string, boolean>
}

export type NotificationItem = {
  id: string
  user_id: string
  type: string
  category: string
  title: string
  message: string
  action_url: string
  read_at?: string | null
  created_at: string
}

export type SiteSummary = {
  id: string
  owner_user_id: string
  name: string
  subdomain: string
  plan_code: string
  region: string
  status: string
  site_url: string
  admin_url: string
  admin_name: string
  admin_email: string
  moodle_username: string
  provisioning_step: string
  last_error: string
  runtime_health?: string
  users_active_limit: number
  storage_bytes_limit: number
  activated_at?: string | null
  created_at: string
  updated_at: string
}

export type SubdomainAvailabilityResponse = {
  available: boolean
  reason?: string
}

export type CreateSiteRequest = {
  name: string
  subdomain: string
  planCode: string
  region: string
  adminName: string
  adminEmail: string
}

export type ProvisioningJob = {
  job_id: string
  site_id: string
  runtime_mode: string
  status: string
  current_step: string
  percent: number
  last_error: string
  created_at: string
  updated_at: string
}

export type ProvisioningStep = {
  id: string
  job_id: string
  step_id: string
  title: string
  description: string
  status: string
  position: number
  created_at: string
  updated_at: string
}

export type SiteRuntimeMetadata = {
  site_id: string
  image_repository: string
  image_tag: string
  web_container_name: string
  cron_container_name: string
  volume_name: string
  database_name: string
  database_user: string
  health_status: string
  last_health_error: string
  last_health_checked_at?: string | null
  created_at: string
  updated_at: string
}

export type SiteUsageSnapshot = {
  site_id: string
  users_active_count: number
  files_bytes_used: number
  database_bytes_used: number
  storage_bytes_used: number
  warning_level: string
  over_limit: boolean
  last_error: string
  measured_at?: string | null
  created_at: string
  updated_at: string
}

export type SiteBackupItem = {
  id: string
  owner_user_id: string
  site_id?: string | null
  site_name: string
  site_subdomain: string
  trigger: "manual" | "scheduled"
  status: "pending" | "running" | "completed" | "failed"
  object_key: string
  size_bytes: number
  sha256: string
  expires_at?: string | null
  last_error: string
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export type SiteBackupSettings = {
  site_id: string
  enabled: boolean
  frequency: "daily" | "weekly" | "monthly"
  retention_days: number
  created_at: string
  updated_at: string
}

export type SiteBackupsResponse = {
  settings: SiteBackupSettings
  backups: SiteBackupItem[]
}

export type SiteReportSummaryMetrics = {
  login_count: number
  active_users: number
  submissions: number
  avg_online_seconds: number
  avg_online_label: string
}

export type SiteReportRecentActivityItem = {
  user_name: string
  action: string
  occurred_at: string
  ip_address: string
}

export type SiteReportCourseCompletionItem = {
  course_id: number
  course_name: string
  enrolled: number
  completed: number
  in_progress: number
  not_started: number
  completion_rate: number
}

export type SiteReportGradeRecapItem = {
  course_id: number
  course_name: string
  average_grade: number
  highest_grade: number
  lowest_grade: number
  passed: number
  failed: number
}

export type SiteReportUserActivityItem = {
  user_id: number
  user_name: string
  role_label: string
  sessions: number
  total_online_seconds: number
  total_online_label: string
  submissions: number
  last_action_at: string
}

export type SiteReportSnapshotPayload = {
  summary_metrics: SiteReportSummaryMetrics
  recent_activity: SiteReportRecentActivityItem[]
  course_completion_summary: SiteReportCourseCompletionItem[]
  grade_recap_per_course: SiteReportGradeRecapItem[]
  user_activity_summary: SiteReportUserActivityItem[]
}

export type SiteReportSnapshot = {
  id: string
  site_id: string
  snapshot_key: string
  period_key: string
  period_start: string
  period_end: string
  payload: SiteReportSnapshotPayload
  plugin_version: string
  moodle_version: string
  generated_at: string
  received_at: string
  created_at: string
  updated_at: string
}

export type SiteSystemSummary = {
  moodle_version: string
  php_version: string
  database_label: string
}

export type CreateSiteResponse = MessageResponse & {
  site: SiteSummary
  job: ProvisioningJob
}

export type SiteResponse = {
  site: SiteSummary
}

export type ProvisioningStatusResponse = {
  site: SiteSummary
  job: ProvisioningJob
  runtime?: SiteRuntimeMetadata | null
  steps: ProvisioningStep[]
}

export type SiteRuntimeService = {
  name: string
  container_name: string
  state: string
  health_status: string
  started_at?: string | null
  finished_at?: string | null
  status_text: string
}

export type SiteRuntimeStatus = {
  site: SiteSummary
  runtime_mode: string
  controllable: boolean
  overall_status: string
  last_error: string
  services: SiteRuntimeService[]
  runtime?: SiteRuntimeMetadata | null
  system?: SiteSystemSummary | null
}

export type SiteCustomDomainStatus = {
  supported: boolean
  domain: string
  status: string
  cname_target: string
  txt_name: string
  txt_value: string
  last_error: string
  verified_at?: string | null
  activated_at?: string | null
}

export type SiteSettingsResponse = {
  site: SiteSummary
  runtime?: SiteRuntimeMetadata | null
  custom_domain: SiteCustomDomainStatus
  custom_domain_enabled: boolean
}

type MessageResponse = {
  message: string
}

type UserResponse = MessageResponse & {
  user: AuthUser
}

type SessionsResponse = {
  sessions: SessionInfo[]
  current_session_id?: string | null
}

type NotificationPreferencesResponse = MessageResponse & {
  preferences: NotificationPreferences
}

type NotificationsResponse = {
  notifications: NotificationItem[]
}

type SitesResponse = {
  sites: SiteSummary[]
}

type SiteUsageResponse = {
  usage: SiteUsageSnapshot
}

type SiteMutationResponse = MessageResponse & {
  site: SiteSummary
}

type SiteCustomDomainMutationResponse = MessageResponse & {
  site: SiteSummary
  custom_domain: SiteCustomDomainStatus
}

type SiteBackupMutationResponse = MessageResponse & {
  backup: SiteBackupItem
}

type SiteBackupSettingsMutationResponse = MessageResponse & {
  settings: SiteBackupSettings
}

type SiteReportSnapshotResponse = {
  snapshot: SiteReportSnapshot
}

export class APIError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "APIError"
    this.status = status
  }
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/v1").replace(/\/$/, "")

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const hasBody = init?.body !== undefined

  headers.set("Accept", "application/json")
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json") ? await response.json() : null

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`
    throw new APIError(message, response.status)
  }

  return payload as T
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError
}

async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  const headers = new Headers(init?.headers)
  const hasBody = init?.body !== undefined

  headers.set("Accept", "application/gzip, application/json, */*")
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const payload = await response.json()
      if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
        message = payload.error
      }
    }
    throw new APIError(message, response.status)
  }

  return await response.blob()
}

export const api = {
  register(input: RegisterRequest) {
    return apiFetch<UserResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        company: input.company,
        password: input.password,
        confirm_password: input.confirmPassword,
      }),
    })
  },

  verifyEmail(input: VerifyEmailRequest) {
    return apiFetch<UserResponse>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        code: input.code,
      }),
    })
  },

  resendVerification(email: string) {
    return apiFetch<MessageResponse>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  },

  login(input: LoginRequest) {
    return apiFetch<UserResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        remember_me: input.rememberMe,
      }),
    })
  },

  logout() {
    return apiFetch<MessageResponse>("/auth/logout", {
      method: "POST",
    })
  },

  forgotPassword(input: ForgotPasswordRequest) {
    return apiFetch<MessageResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
      }),
    })
  },

  resetPassword(input: ResetPasswordRequest) {
    return apiFetch<MessageResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: input.token,
        new_password: input.newPassword,
      }),
    })
  },

  getMe() {
    return apiFetch<{ user: AuthUser }>("/me")
  },

  updateMe(input: UpdateProfileRequest) {
    return apiFetch<UserResponse>("/me", {
      method: "PATCH",
      body: JSON.stringify({
        name: input.name,
        company: input.company,
        organization: input.organization,
        phone: input.phone,
      }),
    })
  },

  updatePassword(input: UpdatePasswordRequest) {
    return apiFetch<MessageResponse>("/me/password", {
      method: "PATCH",
      body: JSON.stringify({
        current_password: input.currentPassword,
        new_password: input.newPassword,
      }),
    })
  },

  listSessions() {
    return apiFetch<SessionsResponse>("/me/sessions")
  },

  deleteSession(sessionID: string) {
    return apiFetch<MessageResponse>(`/me/sessions/${sessionID}`, {
      method: "DELETE",
    })
  },

  getNotificationPreferences() {
    return apiFetch<{ preferences: NotificationPreferences }>("/me/notification-preferences")
  },

  updateNotificationPreferences(preferences: NotificationPreferences) {
    return apiFetch<NotificationPreferencesResponse>("/me/notification-preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    })
  },

  listNotifications() {
    return apiFetch<NotificationsResponse>("/notifications")
  },

  listSites() {
    return apiFetch<SitesResponse>("/sites")
  },

  getSubdomainAvailability(value: string) {
    const search = new URLSearchParams({ value })
    return apiFetch<SubdomainAvailabilityResponse>(`/sites/subdomain-availability?${search.toString()}`)
  },

  createSite(input: CreateSiteRequest) {
    return apiFetch<CreateSiteResponse>("/sites", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        subdomain: input.subdomain,
        plan_code: input.planCode,
        region: input.region,
        admin_name: input.adminName,
        admin_email: input.adminEmail,
      }),
    })
  },

  getSiteBySubdomain(subdomain: string) {
    return apiFetch<SiteResponse>(`/sites/by-subdomain/${encodeURIComponent(subdomain)}`)
  },

  getSiteByID(siteID: string) {
    return apiFetch<SiteResponse>(`/sites/${encodeURIComponent(siteID)}`)
  },

  getSiteUsage(siteID: string) {
    return apiFetch<SiteUsageResponse>(`/sites/${encodeURIComponent(siteID)}/usage`)
  },

  getSiteSettings(siteID: string) {
    return apiFetch<SiteSettingsResponse>(`/sites/${encodeURIComponent(siteID)}/settings`)
  },

  getSiteBackups(siteID: string) {
    return apiFetch<SiteBackupsResponse>(`/sites/${encodeURIComponent(siteID)}/backups`)
  },

  getLatestSiteReportSnapshot(siteID: string, input?: { snapshotKey?: string; periodKey?: string }) {
    const search = new URLSearchParams()
    if (input?.snapshotKey) {
      search.set("snapshot_key", input.snapshotKey)
    }
    if (input?.periodKey) {
      search.set("period_key", input.periodKey)
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : ""
    return apiFetch<SiteReportSnapshotResponse>(`/sites/${encodeURIComponent(siteID)}/reports/latest${suffix}`)
  },

  createSiteBackup(siteID: string) {
    return apiFetch<SiteBackupMutationResponse>(`/sites/${encodeURIComponent(siteID)}/backups`, {
      method: "POST",
    })
  },

  updateSiteBackupSettings(siteID: string, input: { enabled: boolean; frequency: "daily" | "weekly" | "monthly"; retentionDays: number }) {
    return apiFetch<SiteBackupSettingsMutationResponse>(`/sites/${encodeURIComponent(siteID)}/backups/settings`, {
      method: "PUT",
      body: JSON.stringify({
        enabled: input.enabled,
        frequency: input.frequency,
        retention_days: input.retentionDays,
      }),
    })
  },

  downloadSiteBackup(siteID: string, backupID: string) {
    return apiFetchBlob(`/sites/${encodeURIComponent(siteID)}/backups/${encodeURIComponent(backupID)}/download`)
  },

  updateSite(siteID: string, input: { name: string }) {
    return apiFetch<SiteMutationResponse>(`/sites/${encodeURIComponent(siteID)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: input.name,
      }),
    })
  },

  getProvisioningStatus(siteID: string) {
    return apiFetch<ProvisioningStatusResponse>(`/sites/${encodeURIComponent(siteID)}/provisioning`)
  },

  getSiteRuntime(siteID: string) {
    return apiFetch<SiteRuntimeStatus>(`/sites/${encodeURIComponent(siteID)}/runtime`)
  },

  startSiteRuntime(siteID: string) {
    return apiFetch<SiteRuntimeStatus>(`/sites/${encodeURIComponent(siteID)}/runtime/start`, {
      method: "POST",
    })
  },

  restartSiteRuntime(siteID: string) {
    return apiFetch<SiteRuntimeStatus>(`/sites/${encodeURIComponent(siteID)}/runtime/restart`, {
      method: "POST",
    })
  },

  stopSiteRuntime(siteID: string) {
    return apiFetch<SiteRuntimeStatus>(`/sites/${encodeURIComponent(siteID)}/runtime/stop`, {
      method: "POST",
    })
  },

  upsertSiteCustomDomain(siteID: string, domain: string) {
    return apiFetch<SiteCustomDomainMutationResponse>(`/sites/${encodeURIComponent(siteID)}/custom-domain`, {
      method: "POST",
      body: JSON.stringify({ domain }),
    })
  },

  deleteSiteCustomDomain(siteID: string) {
    return apiFetch<SiteMutationResponse>(`/sites/${encodeURIComponent(siteID)}/custom-domain`, {
      method: "DELETE",
    })
  },

  deleteSite(siteID: string, confirmSubdomain: string) {
    return apiFetch<MessageResponse>(`/sites/${encodeURIComponent(siteID)}`, {
      method: "DELETE",
      body: JSON.stringify({
        confirm_subdomain: confirmSubdomain,
      }),
    })
  },

  markNotificationRead(notificationID: string) {
    return apiFetch<MessageResponse>(`/notifications/${notificationID}/read`, {
      method: "POST",
    })
  },

  markAllNotificationsRead() {
    return apiFetch<MessageResponse>("/notifications/read-all", {
      method: "POST",
    })
  },

  deleteNotification(notificationID: string) {
    return apiFetch<MessageResponse>(`/notifications/${notificationID}`, {
      method: "DELETE",
    })
  },

  generateCourseOutline(prompt: string) {
    return apiFetch<{ course: any }>("/courses/generate-outline", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    })
  },

  exportCourseMBZ(course: any) {
    return apiFetchBlob("/courses/export-mbz", {
      method: "POST",
      body: JSON.stringify(course),
    })
  },
}
