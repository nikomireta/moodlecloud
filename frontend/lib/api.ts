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
  runtime_last_error?: string
  users_active_limit: number
  storage_bytes_limit: number
  usage?: SiteUsageSnapshot | null
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

export type SitePlanChange = {
  id: string
  site_id?: string | null
  site_name: string
  site_subdomain: string
  owner_user_id: string
  from_plan_code: string
  to_plan_code: string
  status: string
  applied_at: string
  created_at: string
}

export type BillingPaymentMethod = {
  id: string
  customer_id: string
  owner_user_id: string
  provider: string
  provider_token: string
  type: string
  brand: string
  last4: string
  expiry_month: string
  expiry_year: string
  status: string
  reusable: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export type BillingCollectionMethod = "auto_charge" | "manual_invoice"

export type BillingSubscription = {
  id: string
  customer_id: string
  owner_user_id: string
  site_id?: string | null
  site_name: string
  site_subdomain: string
  payment_method_id?: string | null
  provider: string
  provider_subscription_id: string
  status: string
  billing_cycle: string
  collection_method: BillingCollectionMethod
  current_plan_code: string
  pending_plan_code: string
  currency: string
  amount_total: number
  anchor_at?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  next_charge_at?: string | null
  last_charge_failed_at?: string | null
  last_error: string
  canceled_at?: string | null
  created_at: string
  updated_at: string
}

export type BillingInvoice = {
  id: string
  owner_user_id: string
  customer_id: string
  site_id?: string | null
  site_name: string
  site_subdomain: string
  subscription_id?: string | null
  number: string
  provider: string
  external_id: string
  description: string
  status: string
  currency: string
  billing_cycle: string
  from_plan_code: string
  to_plan_code: string
  payment_method_type: string
  amount_subtotal: number
  amount_tax: number
  amount_total: number
  checkout_url: string
  redirect_url: string
  expires_at?: string | null
  paid_at?: string | null
  canceled_at?: string | null
  failed_at?: string | null
  created_at: string
  updated_at: string
}

export type BillingInvoiceItem = {
  id: string
  invoice_id: string
  item_type: string
  name: string
  description: string
  quantity: number
  unit_amount: number
  total_amount: number
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type BillingAttempt = {
  id: string
  invoice_id: string
  subscription_id?: string | null
  provider: string
  external_id: string
  payment_method_type: string
  status: string
  amount: number
  redirect_url: string
  failure_reason: string
  expires_at?: string | null
  paid_at?: string | null
  created_at: string
  updated_at: string
}

export type SiteCheckoutOrder = {
  id: string
  owner_user_id: string
  invoice_id: string
  created_site_id?: string | null
  status: string
  site_name: string
  subdomain: string
  plan_code: string
  billing_cycle: string
  region: string
  admin_name: string
  admin_email: string
  payment_method_type: string
  amount_total: number
  users_active_limit: number
  storage_bytes_limit: number
  web_cpu_millicores: number
  web_memory_mib: number
  cron_cpu_millicores: number
  cron_memory_mib: number
  expires_at?: string | null
  paid_at?: string | null
  provisioning_started_at?: string | null
  completed_at?: string | null
  canceled_at?: string | null
  last_error: string
  created_at: string
  updated_at: string
}

export type BillingSiteSnapshot = {
  site_id?: string | null
  site_name: string
  site_subdomain: string
}

export type BillingOverview = {
  sites: SiteSummary[]
  changes: SitePlanChange[]
  invoices: BillingInvoice[]
  payment_methods: BillingPaymentMethod[]
  subscriptions: BillingSubscription[]
}

export type BillingProviderConfig = {
  provider: string
  enabled: boolean
  environment: string
  client_key: string
  script_url: string
  supports_card_tokenization: boolean
}

export type CreateBillingCheckoutRequest = {
  siteID: string
  targetPlanCode: string
  billingCycle: "monthly" | "yearly"
  paymentMethodType: "card" | "bank" | "ewallet"
  fullName: string
  email: string
  phone: string
  organization: string
  cardTokenID?: string
}

export type CreateSiteCheckoutRequest = {
  siteName: string
  subdomain: string
  planCode: string
  billingCycle: "monthly" | "yearly"
  region: string
  adminName: string
  adminEmail: string
  paymentMethodType: "card" | "bank" | "ewallet"
  fullName: string
  email: string
  phone: string
  organization: string
  cardTokenID?: string
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
  completions: number
  session_count: number
  avg_online_seconds: number
  avg_online_label: string
}

export type SiteReportDailyTrendItem = {
  day_bucket: number
  day_label: string
  login_count: number
  active_users: number
  submission_count: number
  completion_count: number
  session_time_seconds: number
  session_time_label: string
}

export type SiteReportRecentActivityItem = {
  user_name: string
  action: string
  occurred_at: string
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

export type SiteReportAssignmentSubmissionItem = {
  assignment_id: number
  activity_id: number
  grade_item_id: number
  course_id: number
  course_name: string
  assignment_name: string
  user_id: number
  user_name: string
  due_at: string
  submitted_at: string
  status_key: string
  status_label: string
  grade: number | null
  graded_at: string
  missing_grade: boolean
  late_by_seconds: number
  late_by_label: string
}

export type SiteReportForumEngagementItem = {
  forum_id: number
  activity_id: number
  course_id: number
  course_name: string
  forum_name: string
  discussion_count: number
  post_count: number
  active_participants: number
  latest_post_at: string
}

export type SiteReportGradeRecapItem = {
  course_id: number
  course_name: string
  average_grade: number | null
  highest_grade: number | null
  lowest_grade: number | null
  graded_count: number
  missing_grade_count: number
  passed: number
  failed: number
}

export type SiteReportGradebookDetailItem = {
  course_id: number
  course_name: string
  user_id: number
  user_name: string
  grade_item_id: number
  grade_item_name: string
  item_module: string
  item_instance: number
  final_grade: number | null
  pass_fail: string
  graded_at: string
  missing_grade: boolean
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

export type SiteReportUserStatusItem = {
  user_id: number
  user_name: string
  role_label: string
  course_id: number
  course_name: string
  course_short_name: string
  enrolment_method: string
  enrolment_method_label: string
  enrolled_on: string
  status_key: string
  status_label: string
  average_grade: number | null
  last_action_at: string
}

export type SiteReportAtRiskUserItem = {
  user_name: string
  role_label: string
  course_name: string
  status_label: string
  average_grade: number | null
  last_action_at: string
  risk_score: number
  risk_reason: string
}

export type SiteReportActivityStatsItem = {
  course_id: number
  course_name: string
  activity_id: number
  module_type: string
  component_name: string
  activity_label: string
  visits: number
  time_spent_seconds: number
  time_spent_label: string
  first_access_at: string
  created_at: string
  num_completed: number
  total_events: number
  unique_users: number
  last_activity_at: string
}

export type SiteReportActivityCompletionItem = {
  course_id: number
  course_name: string
  activity_id: number
  activity_name: string
  module_type: string
  component_name: string
  user_id: number
  user_name: string
  completion_state: number
  completion_state_key: string
  completion_state_label: string
  completion_at: string
  last_action_at: string
}

export type SiteReportQuizActivityItem = {
  quiz_id: number
  quiz_name: string
  course_id: number
  course_name: string
  user_id: number
  user_name: string
  attempts: number
  finished_attempts: number
  best_score: number
  average_score: number
  lowest_score: number
  time_spent_seconds: number
  time_spent_label: string
  status_label: string
  completion_at: string
  last_attempt_at: string
}

export type SiteReportQuizQuestionAnalysisItem = {
  quiz_id: number
  quiz_name: string
  course_id: number
  course_name: string
  question_id: number
  question_name: string
  question_type: string
  attempts: number
  correct_rate: number
  average_score: number
  last_attempt_at: string
}

export type SiteReportSectionCounts = {
  daily_trend: number
  recent_activity: number
  course_completion_summary: number
  assignment_submission_detail: number
  forum_engagement_summary: number
  grade_recap_per_course: number
  gradebook_detail: number
  user_activity_summary: number
  user_status: number
  at_risk_users: number
  activity_stats_summary: number
  activity_completion_detail: number
  quiz_activity_detail: number
  quiz_question_analysis: number
}

export type SiteReportUserStatusDistributionItem = {
  status_key: string
  status_label: string
  total: number
}

export type SiteReportSummaryPayload = {
  summary_metrics: SiteReportSummaryMetrics
  daily_trend: SiteReportDailyTrendItem[]
  section_counts: SiteReportSectionCounts
  user_status_distribution: SiteReportUserStatusDistributionItem[]
  course_completion_summary: SiteReportCourseCompletionItem[]
  assignment_submission_detail: SiteReportAssignmentSubmissionItem[]
  forum_engagement_summary: SiteReportForumEngagementItem[]
  at_risk_users: SiteReportAtRiskUserItem[]
  activity_stats_summary: SiteReportActivityStatsItem[]
  quiz_question_analysis: SiteReportQuizQuestionAnalysisItem[]
}

export type SiteReportFullPayload = {
  summary_metrics: SiteReportSummaryMetrics
  daily_trend: SiteReportDailyTrendItem[]
  section_counts: SiteReportSectionCounts
  selected_course_id?: number
  available_courses: SiteReportDetailCourseItem[]
  course_filter_scope_note?: string
  user_status_distribution: SiteReportUserStatusDistributionItem[]
  course_completion_summary: SiteReportCourseCompletionItem[]
  grade_recap_per_course: SiteReportGradeRecapItem[]
  at_risk_users: SiteReportAtRiskUserItem[]
  assignment_submission_detail: SiteReportAssignmentSubmissionItem[]
  forum_engagement_summary: SiteReportForumEngagementItem[]
  activity_stats_summary: SiteReportActivityStatsItem[]
  quiz_activity_detail: SiteReportQuizActivityItem[]
  quiz_question_analysis: SiteReportQuizQuestionAnalysisItem[]
}

export type SiteReportDetailCourseItem = {
  course_id: number
  course_name: string
}

export type SiteReportDetailRows =
  | SiteReportAtRiskUserItem[]
  | SiteReportUserActivityItem[]
  | SiteReportCourseCompletionItem[]
  | SiteReportAssignmentSubmissionItem[]
  | SiteReportForumEngagementItem[]
  | SiteReportGradebookDetailItem[]
  | SiteReportActivityCompletionItem[]
  | SiteReportQuizActivityItem[]
  | SiteReportQuizQuestionAnalysisItem[]
  | SiteReportRecentActivityItem[]
  | SiteReportGradeRecapItem[]
  | SiteReportActivityStatsItem[]
  | SiteReportUserStatusItem[]

export type SiteReportDetailPayload = {
  section: string
  section_title: string
  section_description: string
  page: number
  page_size: number
  total_count: number
  total_pages: number
  selected_course_id?: number
  available_courses: SiteReportDetailCourseItem[]
  rows: SiteReportDetailRows
}

export type SiteReportSummarySnapshot = {
  id: string
  site_id: string
  snapshot_key: string
  period_key: string
  period_start: string
  period_end: string
  payload: SiteReportSummaryPayload
  plugin_version: string
  moodle_version: string
  generated_at: string
  received_at: string
  created_at: string
  updated_at: string
}

export type SiteReportFullSnapshot = {
  id: string
  site_id: string
  snapshot_key: string
  period_key: string
  period_start: string
  period_end: string
  payload: SiteReportFullPayload
  plugin_version: string
  moodle_version: string
  generated_at: string
  received_at: string
  created_at: string
  updated_at: string
}

export type SiteReportDetailSnapshot = {
  id: string
  site_id: string
  snapshot_key: string
  period_key: string
  period_start: string
  period_end: string
  payload: SiteReportDetailPayload
  plugin_version: string
  moodle_version: string
  generated_at: string
  received_at: string
  created_at: string
  updated_at: string
}

export type SiteReportConnectionState =
  | "not_connected"
  | "connected_waiting_sync"
  | "sync_error"
  | "tracking_active"
  | "tracking_stale"
  | "synced"
  | "synced_no_activity"

export type SiteReportConnectionStatus = {
  site_id: string
  state: SiteReportConnectionState
  state_label: string
  state_message: string
  site_url_snapshot: string
  plugin_version: string
  moodle_version: string
  capabilities: string[]
  tracking_mode: string
  tracking_last_seen_at?: string
  tracking_state: string
  tracking_state_label: string
  tracking_state_message: string
  last_error: string
  registered_at?: string
  last_seen_at?: string
  last_sync_at?: string
  has_snapshot: boolean
  has_activity: boolean
  snapshot_key?: string
  period_key?: string
}

export type SiteReportConnectTokenResponse = {
  status: string
  mode: string
  site_id: string
  registration_token: string
  expires_at?: string
  message: string
}

export type SiteReportHighlight = {
  title: string
  message: string
  tone: "info" | "warning" | "danger" | "success"
}

export type SiteReportSummaryResponse = {
  connection: SiteReportConnectionStatus
  snapshot?: SiteReportSummarySnapshot | null
  highlight: SiteReportHighlight
}

export type SiteReportFullResponse = {
  connection: SiteReportConnectionStatus
  snapshot?: SiteReportFullSnapshot | null
  highlight: SiteReportHighlight
}

export type SiteReportDetailResponse = {
  connection: SiteReportConnectionStatus
  snapshot?: SiteReportDetailSnapshot | null
  highlight: SiteReportHighlight
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
  detail_text?: string
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

export type SitePlanChangeResponse = MessageResponse & {
  site: SiteSummary
  usage?: SiteUsageSnapshot | null
}

export type BillingOverviewResponse = {
  overview: BillingOverview
}

export type BillingInvoiceResponse = {
  invoice: BillingInvoice
  items: BillingInvoiceItem[]
  latest_attempt?: BillingAttempt | null
  site_snapshot: BillingSiteSnapshot
  checkout_order?: SiteCheckoutOrder | null
}

export type BillingCheckoutResponse = MessageResponse & {
  invoice: BillingInvoice
  attempt: BillingAttempt
  provider: BillingProviderConfig
}

export type SiteAdminAccessLinkResponse = MessageResponse & {
  login_url: string
  access_token: string
  login_method: string
  expires_at: string
}

export type SitePlanChangesResponse = {
  changes: SitePlanChange[]
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
  snapshot: SiteReportFullSnapshot
}

type SiteReportConnectionResponse = {
  connection: SiteReportConnectionStatus
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
const SITE_REPORT_PLUGIN_API_BASE_URL = API_BASE_URL.endsWith("/v1") ? API_BASE_URL.slice(0, -3) : API_BASE_URL

export function getSiteReportPluginAPIBaseURL(): string {
  return SITE_REPORT_PLUGIN_API_BASE_URL
}

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

  getBillingConfig() {
    return apiFetch<BillingProviderConfig>("/billing/config")
  },

  getBillingOverview() {
    return apiFetch<BillingOverviewResponse>("/billing/overview")
  },

  getBillingInvoice(invoiceID: string) {
    return apiFetch<BillingInvoiceResponse>(`/billing/invoices/${encodeURIComponent(invoiceID)}`)
  },

  continueBillingInvoiceCheckout(invoiceID: string) {
    return apiFetch<BillingCheckoutResponse>(`/billing/invoices/${encodeURIComponent(invoiceID)}/checkout`, {
      method: "POST",
    })
  },

  createBillingCheckout(input: CreateBillingCheckoutRequest) {
    return apiFetch<BillingCheckoutResponse>("/billing/checkouts", {
      method: "POST",
      body: JSON.stringify({
        site_id: input.siteID,
        target_plan_code: input.targetPlanCode,
        billing_cycle: input.billingCycle,
        payment_method_type: input.paymentMethodType,
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        organization: input.organization,
        card_token_id: input.cardTokenID,
      }),
    })
  },

  createSiteCheckout(input: CreateSiteCheckoutRequest) {
    return apiFetch<BillingCheckoutResponse>("/billing/site-checkouts", {
      method: "POST",
      body: JSON.stringify({
        site_name: input.siteName,
        subdomain: input.subdomain,
        plan_code: input.planCode,
        billing_cycle: input.billingCycle,
        region: input.region,
        admin_name: input.adminName,
        admin_email: input.adminEmail,
        payment_method_type: input.paymentMethodType,
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        organization: input.organization,
        card_token_id: input.cardTokenID,
      }),
    })
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

  listSitePlanChanges() {
    return apiFetch<SitePlanChangesResponse>("/sites/plan-changes")
  },

  getSitePlanChanges(siteID: string) {
    return apiFetch<SitePlanChangesResponse>(`/sites/${encodeURIComponent(siteID)}/plan-changes`)
  },

  getSiteSettings(siteID: string) {
    return apiFetch<SiteSettingsResponse>(`/sites/${encodeURIComponent(siteID)}/settings`)
  },

  getSiteBackups(siteID: string) {
    return apiFetch<SiteBackupsResponse>(`/sites/${encodeURIComponent(siteID)}/backups`)
  },

  getSiteReportConnection(siteID: string) {
    return apiFetch<SiteReportConnectionResponse>(`/sites/${encodeURIComponent(siteID)}/report-connection`)
  },

  issueSiteReportConnectToken(siteID: string) {
    return apiFetch<SiteReportConnectTokenResponse>(`/sites/${encodeURIComponent(siteID)}/report-connection/connect-token`, {
      method: "POST",
    })
  },

  getSiteReportSummary(siteID: string, input?: { snapshotKey?: string; periodKey?: string }) {
    const search = new URLSearchParams()
    if (input?.snapshotKey) {
      search.set("snapshot_key", input.snapshotKey)
    }
    if (input?.periodKey) {
      search.set("period_key", input.periodKey)
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : ""
    return apiFetch<SiteReportSummaryResponse>(`/sites/${encodeURIComponent(siteID)}/reports/summary${suffix}`)
  },

  getSiteFullReport(siteID: string, input?: { snapshotKey?: string; periodKey?: string; courseID?: number }) {
    const search = new URLSearchParams()
    if (input?.snapshotKey) {
      search.set("snapshot_key", input.snapshotKey)
    }
    if (input?.periodKey) {
      search.set("period_key", input.periodKey)
    }
    if (typeof input?.courseID === "number" && Number.isFinite(input.courseID) && input.courseID > 0) {
      search.set("course_id", String(input.courseID))
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : ""
    return apiFetch<SiteReportFullResponse>(`/sites/${encodeURIComponent(siteID)}/reports/full${suffix}`)
  },

  getSiteReportDetail(
    siteID: string,
    input: { section: string; snapshotKey?: string; periodKey?: string; courseID?: number; page?: number },
  ) {
    const search = new URLSearchParams()
    search.set("section", input.section)
    if (input.snapshotKey) {
      search.set("snapshot_key", input.snapshotKey)
    }
    if (input.periodKey) {
      search.set("period_key", input.periodKey)
    }
    if (typeof input.courseID === "number" && Number.isFinite(input.courseID) && input.courseID > 0) {
      search.set("course_id", String(input.courseID))
    }
    if (typeof input.page === "number" && Number.isFinite(input.page) && input.page > 0) {
      search.set("page", String(input.page))
    }
    return apiFetch<SiteReportDetailResponse>(`/sites/${encodeURIComponent(siteID)}/reports/detail?${search.toString()}`)
  },

  downloadSiteReportDetailCSV(
    siteID: string,
    input: { section: string; snapshotKey?: string; periodKey?: string; courseID?: number },
  ) {
    const search = new URLSearchParams()
    search.set("section", input.section)
    search.set("export", "csv")
    if (input.snapshotKey) {
      search.set("snapshot_key", input.snapshotKey)
    }
    if (input.periodKey) {
      search.set("period_key", input.periodKey)
    }
    if (typeof input.courseID === "number" && Number.isFinite(input.courseID) && input.courseID > 0) {
      search.set("course_id", String(input.courseID))
    }
    return apiFetchBlob(`/sites/${encodeURIComponent(siteID)}/reports/detail?${search.toString()}`)
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

  changeSitePlan(siteID: string, input: { planCode: string }) {
    return apiFetch<SitePlanChangeResponse>(`/sites/${encodeURIComponent(siteID)}/plan-change`, {
      method: "POST",
      body: JSON.stringify({
        plan_code: input.planCode,
      }),
    })
  },

  issueSiteAdminAccessLink(siteID: string) {
    return apiFetch<SiteAdminAccessLinkResponse>(`/sites/${encodeURIComponent(siteID)}/admin-access-link`, {
      method: "POST",
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
