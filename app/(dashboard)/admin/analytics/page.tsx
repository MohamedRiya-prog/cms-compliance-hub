import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { AnalyticsClient } from './analytics-client'

export default async function AdminAnalyticsPage() {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return notFound()

  const db = createAdminClient()

  // Fetch all completed compliance reports
  const { data: reports } = await db
    .from('compliance_reports')
    .select('id, product_family, status, summary, created_at, projects!inner(user_id)')
    .not('status', 'in', '("generating","error")')

  // Fetch failing rows for gap analysis
  const { data: failingRows } = await db
    .from('compliance_rows')
    .select('status, requirement, clause, compliance_reports!inner(product_family, id)')
    .in('status', ['not_comply', 'noted'])

  // Fetch all profiles
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, email')

  type ReportRow = {
    id: string
    product_family: string
    status: string
    summary: { total?: number; comply?: number; notComply?: number; noted?: number; not_part_of_proposal?: number } | null
    created_at: string
    projects: { user_id: string }
  }
  type FailingRow = {
    status: string
    requirement: string
    clause: string
    compliance_reports: { product_family: string; id: string }
  }
  type ProfileRow = {
    id: string
    full_name: string | null
    email: string | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportsArr = ((reports ?? []) as unknown as any[]) as ReportRow[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowsArr = ((failingRows ?? []) as unknown as any[]) as FailingRow[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profilesArr = ((profiles ?? []) as unknown as any[]) as ProfileRow[]

  const profileMap = new Map(profilesArr.map(p => [p.id, p]))

  // ── Overview ────────────────────────────────────────────────────────────────
  const totalReports = reportsArr.length
  const totalClauses = reportsArr.reduce((a, r) => a + (r.summary?.total ?? 0), 0)
  const totalComply = reportsArr.reduce((a, r) => a + (r.summary?.comply ?? 0), 0)
  const avgComplianceRate = totalClauses > 0 ? Math.round((totalComply / totalClauses) * 100) : 0
  const activeUsers = new Set(reportsArr.map(r => r.projects.user_id)).size

  // ── Products ────────────────────────────────────────────────────────────────
  const productMap = new Map<string, {
    family: string
    reports: number
    totalClauses: number
    comply: number
    notComply: number
    noted: number
    notPartOfProposal: number
    lastActivity: string
  }>()

  for (const r of reportsArr) {
    const fam = r.product_family
    if (!productMap.has(fam)) {
      productMap.set(fam, {
        family: fam,
        reports: 0,
        totalClauses: 0,
        comply: 0,
        notComply: 0,
        noted: 0,
        notPartOfProposal: 0,
        lastActivity: r.created_at,
      })
    }
    const entry = productMap.get(fam)!
    entry.reports++
    entry.totalClauses += r.summary?.total ?? 0
    entry.comply += r.summary?.comply ?? 0
    entry.notComply += r.summary?.notComply ?? 0
    entry.noted += r.summary?.noted ?? 0
    entry.notPartOfProposal += r.summary?.not_part_of_proposal ?? 0
    if (r.created_at > entry.lastActivity) entry.lastActivity = r.created_at
  }

  const products = Array.from(productMap.values())
    .map(p => ({
      ...p,
      complianceRate: p.totalClauses > 0 ? Math.round((p.comply / p.totalClauses) * 100) : 0,
    }))
    .sort((a, b) => a.complianceRate - b.complianceRate)

  // ── Gaps ────────────────────────────────────────────────────────────────────
  const gapMap = new Map<string, {
    family: string
    requirement: string
    clause: string
    count: number
    type: string
  }>()

  for (const row of rowsArr) {
    const fam = row.compliance_reports.product_family
    const reqKey = (row.requirement ?? '').slice(0, 120)
    const key = `${fam}|||${reqKey}`
    if (!gapMap.has(key)) {
      gapMap.set(key, {
        family: fam,
        requirement: row.requirement ?? '',
        clause: row.clause ?? '',
        count: 0,
        type: row.status,
      })
    }
    gapMap.get(key)!.count++
  }

  const gapsByFamily = new Map<string, Array<{ family: string; requirement: string; clause: string; count: number; type: string }>>()
  for (const gap of gapMap.values()) {
    if (!gapsByFamily.has(gap.family)) gapsByFamily.set(gap.family, [])
    gapsByFamily.get(gap.family)!.push(gap)
  }

  const gaps: Array<{ family: string; requirement: string; clause: string; count: number; type: string }> = []
  for (const [, familyGaps] of gapsByFamily) {
    const top5 = familyGaps.sort((a, b) => b.count - a.count).slice(0, 5)
    gaps.push(...top5)
  }

  // ── Users ────────────────────────────────────────────────────────────────────
  const userMap = new Map<string, {
    userId: string
    reports: number
    totalClauses: number
    comply: number
    lastActivity: string
  }>()

  for (const r of reportsArr) {
    const uid = r.projects.user_id
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        userId: uid,
        reports: 0,
        totalClauses: 0,
        comply: 0,
        lastActivity: r.created_at,
      })
    }
    const entry = userMap.get(uid)!
    entry.reports++
    entry.totalClauses += r.summary?.total ?? 0
    entry.comply += r.summary?.comply ?? 0
    if (r.created_at > entry.lastActivity) entry.lastActivity = r.created_at
  }

  const users = Array.from(userMap.values())
    .map(u => {
      const prof = profileMap.get(u.userId)
      return {
        userId: u.userId,
        name: prof?.full_name ?? prof?.email ?? 'Unknown',
        email: prof?.email ?? '',
        reports: u.reports,
        totalClauses: u.totalClauses,
        comply: u.comply,
        complianceRate: u.totalClauses > 0 ? Math.round((u.comply / u.totalClauses) * 100) : 0,
        lastActivity: u.lastActivity,
      }
    })
    .sort((a, b) => b.reports - a.reports)

  return (
    <AnalyticsClient
      overview={{ totalReports, totalClauses, avgComplianceRate, activeUsers }}
      products={products}
      gaps={gaps}
      users={users}
    />
  )
}
