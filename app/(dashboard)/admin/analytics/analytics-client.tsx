'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import Link from 'next/link'
import { FileText, CheckCircle, Users, Hash, X, ExternalLink } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  totalReports: number
  totalClauses: number
  avgComplianceRate: number
  activeUsers: number
}

interface ProductStat {
  family: string
  reports: number
  totalClauses: number
  comply: number
  notComply: number
  noted: number
  notPartOfProposal: number
  complianceRate: number
  lastActivity: string
}

interface GapReport {
  reportId: string
  projectId: string
  projectName: string
  title: string
  createdAt: string
}

interface GapItem {
  family: string
  requirement: string
  clause: string
  count: number
  type: string
  reports: GapReport[]
}

interface UserStat {
  userId: string
  name: string
  email: string
  reports: number
  totalClauses: number
  comply: number
  complianceRate: number
  lastActivity: string
}

interface Props {
  overview: Overview
  products: ProductStat[]
  gaps: GapItem[]
  users: UserStat[]
  dailyCounts: Record<string, number>
}

// ── Bar colours ──────────────────────────────────────────────────────────────

function barColor(rate: number) {
  if (rate >= 80) return 'oklch(0.72 0.19 155)'
  if (rate >= 50) return 'oklch(0.78 0.16 85)'
  return 'oklch(0.68 0.22 25)'
}

// ── Compliance rate label colour ─────────────────────────────────────────────

function rateColor(rate: number) {
  if (rate >= 80) return 'var(--status-comply)'
  if (rate >= 50) return 'var(--status-noted)'
  return 'var(--status-not-comply)'
}

// ── Custom Recharts tooltip ──────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ProductStat }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      className="rounded-lg px-3 py-2.5 text-xs space-y-1"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
        minWidth: 180,
      }}
    >
      <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{d.family}</p>
      <p style={{ color: rateColor(d.complianceRate) }}>
        Compliance: <strong>{d.complianceRate}%</strong>
      </p>
      <p style={{ color: 'var(--text-secondary)' }}>Reports: {d.reports}</p>
      <p style={{ color: 'var(--status-comply)' }}>Comply: {d.comply}</p>
      <p style={{ color: 'var(--status-not-comply)' }}>Not Comply: {d.notComply}</p>
      <p style={{ color: 'var(--status-noted)' }}>Noted: {d.noted}</p>
    </div>
  )
}

// ── Calendar heat colours ────────────────────────────────────────────────────

function heatColor(count: number): string {
  if (count === 0) return 'var(--surface-2)'
  if (count <= 2) return 'oklch(0.80 0.10 250)'
  if (count <= 5) return 'oklch(0.60 0.18 250)'
  return 'oklch(0.42 0.22 250)'
}

// ── Year calendar component (GitHub contribution style) ──────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CELL = 11   // px — cell width & height
const GAP  = 3    // px — gap between cells

function YearCalendar({ dailyCounts }: { dailyCounts: Record<string, number> }) {
  const now   = new Date()
  const year  = now.getFullYear()
  const todayKey = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Build a flat list of every day in the year, pre-padded so col 0 row 0 = Monday
  type DayCell = { key: string; date: Date } | null
  const jan1Dow    = new Date(year, 0, 1).getDay()          // 0=Sun
  const startPad   = (jan1Dow + 6) % 7                       // shift to Mon-first
  const totalDays  = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365

  const flat: DayCell[] = Array(startPad).fill(null)
  for (let i = 0; i < totalDays; i++) {
    const d   = new Date(year, 0, i + 1)
    const key = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    flat.push({ key, date: d })
  }
  while (flat.length % 7 !== 0) flat.push(null)

  // Slice into week columns (each 7 days = rows Mon→Sun)
  const weeks: DayCell[][] = []
  for (let w = 0; w < flat.length / 7; w++) {
    weeks.push(flat.slice(w * 7, w * 7 + 7))
  }

  // Month label positions — first week where a new month appears
  const monthLabels: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    for (const cell of week) {
      if (cell && cell.date.getMonth() !== lastMonth) {
        lastMonth = cell.date.getMonth()
        monthLabels.push({ label: MONTH_NAMES[lastMonth], col: wi })
        break
      }
    }
  })

  const rowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const LABEL_W  = 26   // px for day-label column
  const MONTH_H  = 16   // px for month label row

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Generation Activity
          <span className="ml-2 font-normal text-xs" style={{ color: 'var(--text-muted)' }}>
            {year}
          </span>
        </h2>
        <div className="flex items-center gap-1 text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>
          <span>Less</span>
          {[0, 1, 3, 6].map((n, i) => (
            <div
              key={i}
              style={{ width: CELL, height: CELL, borderRadius: 2, background: heatColor(n), border: '1px solid oklch(0 0 0 / 0.10)', flexShrink: 0 }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Scrollable wrapper (needed on narrow screens) */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 0 }}>

          {/* Day-of-week label column */}
          <div style={{ paddingTop: MONTH_H, marginRight: 4, flexShrink: 0 }}>
            {rowLabels.map((lbl, i) => (
              <div
                key={i}
                style={{
                  height: CELL,
                  width: LABEL_W,
                  marginBottom: i < 6 ? GAP : 0,
                  fontSize: 9,
                  lineHeight: `${CELL}px`,
                  textAlign: 'right',
                  color: 'var(--text-muted)',
                  userSelect: 'none',
                }}
              >
                {lbl}
              </div>
            ))}
          </div>

          {/* Grid area */}
          <div style={{ position: 'relative', flexShrink: 0 }}>

            {/* Month labels row */}
            <div style={{ height: MONTH_H, position: 'relative' }}>
              {monthLabels.map(({ label, col }) => (
                <span
                  key={label}
                  style={{
                    position: 'absolute',
                    left: col * (CELL + GAP),
                    fontSize: 10,
                    lineHeight: `${MONTH_H}px`,
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Week columns */}
            <div style={{ display: 'flex', gap: GAP }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP, flexShrink: 0 }}>
                  {week.map((cell, di) => {
                    if (!cell) {
                      return <div key={di} style={{ width: CELL, height: CELL }} />
                    }
                    const count   = dailyCounts[cell.key] ?? 0
                    const isToday = cell.key === todayKey
                    return (
                      <div
                        key={di}
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 2,
                          background: heatColor(count),
                          border: isToday
                            ? '1.5px solid var(--brand-primary)'
                            : '1px solid oklch(0 0 0 / 0.07)',
                          flexShrink: 0,
                        }}
                        title={
                          count > 0
                            ? `${count} report${count !== 1 ? 's' : ''} — ${cell.key}`
                            : cell.key
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Animation variants ───────────────────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08 },
  }),
}

// ── Main component ───────────────────────────────────────────────────────────

export function AnalyticsClient({ overview, products, gaps, users, dailyCounts }: Props) {
  // Default to the 3 lowest-rate families
  const defaultFamily = products[0]?.family ?? null
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  const [drawerGap, setDrawerGap] = useState<GapItem | null>(null)
  const [drawerPage, setDrawerPage] = useState(0)
  const DRAWER_PAGE_SIZE = 8

  // Reset to page 0 whenever a new gap is opened
  useEffect(() => { setDrawerPage(0) }, [drawerGap?.clause, drawerGap?.family])

  const displayFamily = selectedFamily ?? defaultFamily

  const familyGaps = gaps.filter(g => g.family === displayFamily)

  const chartHeight = Math.max(300, products.length * 44)

  // KPI cards data
  const kpis = [
    {
      label: 'Total Reports',
      value: overview.totalReports,
      icon: FileText,
      color: 'var(--brand-primary)',
    },
    {
      label: 'Avg Compliance Rate',
      value: `${overview.avgComplianceRate}%`,
      icon: CheckCircle,
      color: overview.avgComplianceRate >= 80
        ? 'var(--status-comply)'
        : overview.avgComplianceRate >= 50
        ? 'var(--status-noted)'
        : 'var(--status-not-comply)',
    },
    {
      label: 'Active Users',
      value: overview.activeUsers,
      icon: Users,
      color: 'var(--brand-primary)',
    },
    {
      label: 'Total Clauses Reviewed',
      value: overview.totalClauses.toLocaleString(),
      icon: Hash,
      color: 'var(--text-secondary)',
    },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Analytics
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Platform-wide compliance insights
        </p>
      </motion.div>

      {/* ── Section 1: KPI cards ─────────────────────────────────────────── */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
      >
        {kpis.map(kpi => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="rounded-xl p-4 border"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {kpi.label}
                </p>
                <Icon size={14} style={{ color: kpi.color }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
            </div>
          )
        })}
      </motion.div>

      {/* ── Section 2: Monthly generation heatmap ───────────────────────── */}
      <motion.div
        custom={1}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        className="rounded-xl p-5 border mb-6"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
      >
        <YearCalendar dailyCounts={dailyCounts} />
      </motion.div>

      {/* ── Section 3: Product compliance chart ─────────────────────────── */}
      <motion.div
        custom={2}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        className="rounded-xl p-5 border mb-6 overflow-hidden"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
      >
        <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-secondary)' }}>
          Compliance Rate by Product Family
        </h2>

        {products.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No report data yet
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={products}
              layout="vertical"
              margin={{ top: 0, right: 56, left: 8, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="family"
                width={200}
                tick={{ fontSize: 11, fill: 'var(--text-secondary)', width: 196 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'oklch(1 0 0 / 0.04)' }} />
              <Bar
                dataKey="complianceRate"
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
                cursor="pointer"
                onClick={(data: ProductStat) => setSelectedFamily(data.family)}
              >
                {products.map(p => (
                  <Cell key={p.family} fill={barColor(p.complianceRate)} />
                ))}
                <LabelList
                  dataKey="complianceRate"
                  position="right"
                  formatter={(v: number) => `${v}%`}
                  style={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── Section 4: Gap analysis ──────────────────────────────────────── */}
      {displayFamily && (
        <motion.div
          custom={3}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="rounded-xl p-5 border mb-6"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold min-w-0" style={{ color: 'var(--text-secondary)' }}>
              Common Failing Clauses
              <span className="block mt-0.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {displayFamily}
              </span>
            </h2>
            {selectedFamily && (
              <button
                onClick={() => setSelectedFamily(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs shrink-0 transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>

          {familyGaps.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
              No failing clauses recorded for this product family.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Clause', 'Requirement', 'Occurrences', 'Type'].map(h => (
                      <th
                        key={h}
                        className="text-left pb-2 pr-4 font-medium"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {familyGaps.map((gap, i) => (
                    <tr
                      key={i}
                      className="group transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="py-2.5 pr-4 font-mono" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {gap.clause}
                      </td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--text-primary)', maxWidth: 360 }}>
                        <span className="line-clamp-3" title={gap.requirement}>
                          {gap.requirement}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <button
                          onClick={() => setDrawerGap(gap)}
                          className="font-semibold underline decoration-dotted underline-offset-2 hover:opacity-70 transition-opacity"
                          style={{ color: 'var(--brand-primary)' }}
                          title="Click to see all reports"
                        >
                          {gap.count}
                        </button>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={
                            gap.type === 'not_comply'
                              ? { background: 'oklch(0.68 0.22 25 / 0.15)', color: 'var(--status-not-comply)' }
                              : { background: 'oklch(0.78 0.16 85 / 0.15)', color: 'var(--status-noted)' }
                          }
                        >
                          {gap.type === 'not_comply' ? 'Not Comply' : 'Noted'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Section 5: User activity table ──────────────────────────────── */}
      <motion.div
        custom={4}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        className="rounded-xl p-5 border"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          User Activity
        </h2>

        {users.length === 0 ? (
          <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
            No user data yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['User', 'Reports Generated', 'Clauses Reviewed', 'Compliance Rate', 'Last Activity'].map(h => (
                    <th
                      key={h}
                      className="text-left pb-2 pr-4 font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.userId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="py-2.5 pr-4">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                      <p style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {u.reports}
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--text-secondary)' }}>
                      {u.totalClauses.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold" style={{ color: rateColor(u.complianceRate) }}>
                      {u.complianceRate}%
                    </td>
                    <td className="py-2.5" style={{ color: 'var(--text-muted)' }}>
                      {u.lastActivity ? formatRelativeTime(u.lastActivity) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── Occurrences drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerGap && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: 'oklch(0 0 0 / 0.4)' }}
              onClick={() => setDrawerGap(null)}
            />

            {/* Drawer panel */}
            <motion.div
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col w-full max-w-md"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              style={{ background: 'var(--surface-1)', borderLeft: '1px solid var(--border-default)' }}
            >
              {/* Drawer header */}
              <div className="flex items-start justify-between gap-3 p-5 border-b shrink-0" style={{ borderColor: 'var(--border-default)' }}>
                <div className="min-w-0">
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Failing clause · {drawerGap.count} report{drawerGap.count !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {drawerGap.clause}
                  </p>
                  <p className="text-xs mt-1 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                    {drawerGap.requirement}
                  </p>
                </div>
                <button
                  onClick={() => setDrawerGap(null)}
                  className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Report list — paginated, no scroll */}
              {(() => {
                const totalPages = Math.ceil(drawerGap.reports.length / DRAWER_PAGE_SIZE)
                const pageReports = drawerGap.reports.slice(
                  drawerPage * DRAWER_PAGE_SIZE,
                  (drawerPage + 1) * DRAWER_PAGE_SIZE
                )
                return (
                  <>
                    <div className="flex-1 p-4 space-y-2">
                      {pageReports.map(r => (
                        <Link
                          key={r.reportId}
                          href={`/projects/${r.projectId}/reports/${r.reportId}`}
                          onClick={() => setDrawerGap(null)}
                        >
                          <motion.div
                            whileHover={{ x: 3 }}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer"
                            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {r.projectName}
                              </p>
                              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {r.title} · {formatRelativeTime(r.createdAt)}
                              </p>
                            </div>
                            <ExternalLink size={13} className="shrink-0" style={{ color: 'var(--brand-primary)' }} />
                          </motion.div>
                        </Link>
                      ))}
                    </div>

                    {/* Pagination footer */}
                    {totalPages > 1 && (
                      <div
                        className="shrink-0 flex items-center justify-between px-5 py-3 border-t"
                        style={{ borderColor: 'var(--border-default)' }}
                      >
                        <button
                          onClick={() => setDrawerPage(p => p - 1)}
                          disabled={drawerPage === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                        >
                          ← Prev
                        </button>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Page {drawerPage + 1} of {totalPages}
                        </span>
                        <button
                          onClick={() => setDrawerPage(p => p + 1)}
                          disabled={drawerPage >= totalPages - 1}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
