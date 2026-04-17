'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { FileText, CheckCircle, Users, Hash, X } from 'lucide-react'
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

interface GapItem {
  family: string
  requirement: string
  clause: string
  count: number
  type: string
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

export function AnalyticsClient({ overview, products, gaps, users }: Props) {
  // Default to the 3 lowest-rate families
  const defaultFamily = products[0]?.family ?? null
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)

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

      {/* ── Section 2: Product compliance chart ─────────────────────────── */}
      <motion.div
        custom={1}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
        className="rounded-xl p-5 border mb-6"
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
              data={products.map(p => ({ ...p, truncatedFamily: p.family.slice(0, 20) }))}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
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
                dataKey="truncatedFamily"
                width={130}
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
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

      {/* ── Section 3: Gap analysis ──────────────────────────────────────── */}
      {displayFamily && (
        <motion.div
          key={displayFamily}
          custom={2}
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="rounded-xl p-5 border mb-6"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Common Failing Clauses —{' '}
              <span style={{ color: 'var(--text-primary)' }}>{displayFamily}</span>
            </h2>
            {selectedFamily && (
              <button
                onClick={() => setSelectedFamily(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors hover:bg-[var(--surface-2)]"
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
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <td className="py-2.5 pr-4 font-mono" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {gap.clause}
                      </td>
                      <td className="py-2.5 pr-4" style={{ color: 'var(--text-primary)', maxWidth: 320 }}>
                        <span title={gap.requirement}>
                          {gap.requirement.slice(0, 80)}{gap.requirement.length > 80 ? '…' : ''}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {gap.count}
                      </td>
                      <td className="py-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={
                            gap.type === 'not_comply'
                              ? {
                                  background: 'oklch(0.68 0.22 25 / 0.15)',
                                  color: 'var(--status-not-comply)',
                                }
                              : {
                                  background: 'oklch(0.78 0.16 85 / 0.15)',
                                  color: 'var(--status-noted)',
                                }
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

      {/* ── Section 4: User activity table ──────────────────────────────── */}
      <motion.div
        custom={3}
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
    </div>
  )
}
