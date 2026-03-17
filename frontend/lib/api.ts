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

type SiteMutationResponse = MessageResponse & {
  site: SiteSummary
}

type SiteCustomDomainMutationResponse = MessageResponse & {
  site: SiteSummary
  custom_domain: SiteCustomDomainStatus
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

  getSiteSettings(siteID: string) {
    return apiFetch<SiteSettingsResponse>(`/sites/${encodeURIComponent(siteID)}/settings`)
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
}
