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
    .select('status, requirement, clause, compliance_reports!inner(id, title, product_family, project_id, created_at)')
    .in('status', ['not_comply', 'noted'])

  // Fetch all projects for name lookup
  const { data: projects } = await db
    .from('projects')
    .select('id, name')

  const projectNameMap = new Map((projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))

  // Fetch all profiles (no email column — get that from auth)
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name')

  // Fetch auth users for emails (requires service-role key)
  const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 })

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
    compliance_reports: { id: string; title: string; product_family: string; project_id: string; created_at: string }
  }
  type ProfileRow = {
    id: string
    full_name: string | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportsArr = ((reports ?? []) as unknown as any[]) as ReportRow[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowsArr = ((failingRows ?? []) as unknown as any[]) as FailingRow[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profilesArr = ((profiles ?? []) as unknown as any[]) as ProfileRow[]

  // Build email map from auth users
  const emailMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.email ?? '']))

  const profileMap = new Map(profilesArr.map(p => [p.id, p]))

  // ── Daily generation counts (current year) ──────────────────────────────────
  const now = new Date()
  const year = now.getFullYear()
  const dailyCounts: Record<string, number> = {}
  for (const r of reportsArr) {
    const d = new Date(r.created_at)
    if (d.getFullYear() === year) {
      const key = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      dailyCounts[key] = (dailyCounts[key] ?? 0) + 1
    }
  }

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
  type GapReport = { reportId: string; projectId: string; projectName: string; title: string; createdAt: string }

  const gapMap = new Map<string, {
    family: string
    requirement: string
    clause: string
    type: string
    reports: GapReport[]
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
        type: row.status,
        reports: [],
      })
    }
    const entry = gapMap.get(key)!
    // Only add each report once
    if (!entry.reports.find(r => r.reportId === row.compliance_reports.id)) {
      entry.reports.push({
        reportId: row.compliance_reports.id,
        projectId: row.compliance_reports.project_id,
        projectName: projectNameMap.get(row.compliance_reports.project_id) ?? 'Unknown Project',
        title: row.compliance_reports.title,
        createdAt: row.compliance_reports.created_at,
      })
    }
  }

  const gapsByFamily = new Map<string, typeof gaps>()
  const gaps: Array<{
    family: string; requirement: string; clause: string; type: string
    count: number; reports: GapReport[]
  }> = []

  for (const entry of gapMap.values()) {
    // Sort reports newest first
    entry.reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const gap = { ...entry, count: entry.reports.length }
    if (!gapsByFamily.has(entry.family)) gapsByFamily.set(entry.family, [])
    gapsByFamily.get(entry.family)!.push(gap)
  }

  gaps.length = 0
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
      const email = emailMap.get(u.userId) ?? ''
      const name = prof?.full_name?.trim() || email.split('@')[0] || 'Unknown'
      return {
        userId: u.userId,
        name,
        email,
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
      dailyCounts={dailyCounts}
    />
  )
}
