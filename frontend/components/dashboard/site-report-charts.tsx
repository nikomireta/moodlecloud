"use client"

import { useMemo } from "react"
import { Cell, Pie, PieChart, Bar, BarChart, CartesianGrid, Label, Line, LineChart, XAxis, YAxis } from "recharts"
import type { SiteReportCourseCompletionItem, SiteReportDailyTrendItem, SiteReportUserStatusDistributionItem } from "@/lib/api"
import {
  buildActivityTrendSummary,
  buildActivityTrendChartData,
  buildCourseCompletionChartData,
  buildCourseCompletionSummaryStats,
  buildSessionTimeChartData,
  buildSessionTimeSummary,
  buildUserStatusDistributionData,
  buildUserStatusDistributionSummary,
  formatDurationShort,
} from "@/lib/site-report-charts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const activityTrendConfig = {
  loginCount: {
    label: "Login",
    color: "#2563eb",
  },
  activeUsers: {
    label: "Pengguna Aktif",
    color: "#16a34a",
  },
  submissionCount: {
    label: "Pengumpulan",
    color: "#7c3aed",
  },
  completionCount: {
    label: "Penyelesaian",
    color: "#059669",
  },
} satisfies ChartConfig

const sessionTimeConfig = {
  sessionTimeSeconds: {
    label: "Waktu Sesi",
    color: "#d97706",
  },
} satisfies ChartConfig

const courseCompletionConfig = {
  completed: {
    label: "Selesai",
    color: "#059669",
  },
  inProgress: {
    label: "Sedang Berjalan",
    color: "#2563eb",
  },
  notStarted: {
    label: "Belum Mulai",
    color: "#f59e0b",
  },
} satisfies ChartConfig

const userStatusConfig = {
  completed: {
    label: "Selesai",
    color: "#059669",
  },
  in_progress: {
    label: "Sedang Berjalan",
    color: "#2563eb",
  },
  not_started: {
    label: "Belum Mulai",
    color: "#f59e0b",
  },
} satisfies ChartConfig

const userStatusColors: Record<string, string> = {
  completed: "#059669",
  in_progress: "#2563eb",
  not_started: "#f59e0b",
}

const userStatusFallbackColor = "#64748b"

function userStatusColor(statusKey: string) {
  return userStatusColors[statusKey] ?? userStatusFallbackColor
}

function formatCount(value: number) {
  return value.toLocaleString("id-ID")
}

function SummaryPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

export function SiteReportActivityTrendChart({
  rows,
  compact = false,
}: {
  rows: SiteReportDailyTrendItem[]
  compact?: boolean
}) {
  const data = useMemo(() => buildActivityTrendChartData(rows), [rows])
  const summary = useMemo(() => buildActivityTrendSummary(rows), [rows])

  if (data.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <ChartContainer
        config={activityTrendConfig}
        className={compact ? "aspect-auto h-[240px] w-full" : "aspect-auto h-[320px] w-full"}
      >
        <LineChart data={data} margin={{ left: compact ? 4 : 12, right: compact ? 8 : 12, top: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="dayLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={compact ? 20 : 16} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={compact ? 32 : 40} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="line"
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{String(name)}</span>
                    <span className="font-mono font-medium tabular-nums">{formatCount(Number(value))}</span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend
            verticalAlign="top"
            content={<ChartLegendContent className="flex-wrap justify-start gap-x-4 gap-y-2 text-xs md:justify-center" />}
          />
          <Line
            type="monotone"
            dataKey="loginCount"
            stroke="var(--color-loginCount)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="activeUsers"
            stroke="var(--color-activeUsers)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="submissionCount"
            stroke="var(--color-submissionCount)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="completionCount"
            stroke="var(--color-completionCount)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
        <SummaryPill label="Total Login" value={formatCount(summary.totalLogins)} />
        <SummaryPill label="Puncak Aktif" value={`${formatCount(summary.peakActiveUsers)} · ${summary.peakActiveDayLabel}`} />
        <SummaryPill label="Pengumpulan" value={formatCount(summary.totalSubmissions)} />
        <SummaryPill label="Penyelesaian" value={formatCount(summary.totalCompletions)} />
      </div>
    </div>
  )
}

export function SiteReportSessionTimeChart({
  rows,
}: {
  rows: SiteReportDailyTrendItem[]
}) {
  const data = useMemo(() => buildSessionTimeChartData(rows), [rows])
  const summary = useMemo(() => buildSessionTimeSummary(rows), [rows])

  if (data.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <ChartContainer config={sessionTimeConfig} className="aspect-auto h-[320px] w-full">
        <BarChart data={data} margin={{ left: 12, right: 12, top: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="dayLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value) => formatDurationShort(Number(value))}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value) => formatDurationShort(Number(value))}
              />
            }
          />
          <Bar dataKey="sessionTimeSeconds" fill="var(--color-sessionTimeSeconds)" radius={[8, 8, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ChartContainer>

      <div className="grid gap-2 sm:grid-cols-2">
        <SummaryPill label="Total Waktu" value={summary.totalSessionLabel} />
        <SummaryPill label="Rata-rata per Hari" value={summary.averageSessionLabel} />
      </div>
    </div>
  )
}

export function SiteReportCourseCompletionChart({
  rows,
  compact = false,
  limit,
}: {
  rows: SiteReportCourseCompletionItem[]
  compact?: boolean
  limit?: number
}) {
  const data = useMemo(
    () =>
      buildCourseCompletionChartData(rows, {
        limit,
        labelLength: compact ? 18 : 26,
      }),
    [compact, limit, rows],
  )
  const summary = useMemo(() => buildCourseCompletionSummaryStats(rows, { limit }), [limit, rows])

  if (data.length === 0) {
    return null
  }

  const height = Math.max(compact ? 240 : 280, data.length * (compact ? 44 : 52))

  return (
    <div className="space-y-4">
      <ChartContainer
        config={courseCompletionConfig}
        className="aspect-auto w-full"
        style={{ height }}
      >
        <BarChart data={data} layout="vertical" margin={{ left: compact ? 0 : 12, right: 12, top: 12 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="courseLabel"
            width={compact ? 88 : 156}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(_, payload) => payload?.[0]?.payload?.courseName ?? ""}
                formatter={(value, name, _item, _index, payloadItem) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{String(name)}</span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatCount(Number(value))}
                      {name === "Selesai" && payloadItem && typeof payloadItem === "object" && "completionRate" in payloadItem
                        ? ` · ${Number(payloadItem.completionRate).toFixed(1)}%`
                        : ""}
                    </span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend
            verticalAlign="top"
            content={<ChartLegendContent className="flex-wrap justify-start gap-x-4 gap-y-2 text-xs md:justify-center" />}
          />
          <Bar dataKey="completed" stackId="completion" fill="var(--color-completed)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="inProgress" stackId="completion" fill="var(--color-inProgress)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="notStarted" stackId="completion" fill="var(--color-notStarted)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-3"}`}>
        <SummaryPill label="Kursus Ditampilkan" value={formatCount(summary.courseCount)} />
        <SummaryPill label="Total Enrolled" value={formatCount(summary.totalEnrolled)} />
        <SummaryPill label="Rata-rata Completion" value={`${summary.averageCompletionRate.toFixed(1)}%`} />
      </div>
    </div>
  )
}

export function SiteReportUserStatusDistributionChart({
  rows,
}: {
  rows: SiteReportUserStatusDistributionItem[]
}) {
  const data = useMemo(() => buildUserStatusDistributionData(rows), [rows])
  const total = data.reduce((sum, row) => sum + row.total, 0)
  const summary = useMemo(() => buildUserStatusDistributionSummary(rows), [rows])

  if (data.length === 0 || total === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <ChartContainer config={userStatusConfig} className="aspect-auto h-[320px] w-full">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                nameKey="statusLabel"
                formatter={(value) => `${Number(value).toLocaleString("id-ID")} peserta`}
              />
            }
          />
          <Pie
            data={data}
            dataKey="total"
            nameKey="statusLabel"
            innerRadius={70}
            outerRadius={105}
            paddingAngle={3}
          >
            <Label
              content={({ viewBox }) => {
                if (
                  !viewBox ||
                  !("cx" in viewBox) ||
                  !("cy" in viewBox) ||
                  typeof viewBox.cx !== "number" ||
                  typeof viewBox.cy !== "number"
                ) {
                  return null
                }

                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                      {formatCount(summary.totalTracked)}
                    </tspan>
                    <tspan x={viewBox.cx} y={viewBox.cy + 20} className="fill-muted-foreground text-xs">
                      peserta
                    </tspan>
                  </text>
                )
              }}
            />
            {data.map((row) => (
              <Cell key={row.statusKey} fill={userStatusColor(row.statusKey)} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="grid gap-2 sm:grid-cols-2">
        <SummaryPill label="Total Tercatat" value={`${formatCount(summary.totalTracked)} peserta`} />
        <SummaryPill label="Status Dominan" value={`${summary.dominantStatusLabel} · ${formatCount(summary.dominantStatusTotal)}`} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {data.map((row) => (
          <div key={row.statusKey} className="rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: userStatusColor(row.statusKey) }}
              />
              <span className="font-medium">{row.statusLabel}</span>
            </div>
            <p className="mt-2 text-lg font-semibold">{row.total.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted-foreground">
              {Math.round((row.total / total) * 100)}% dari total peserta
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
