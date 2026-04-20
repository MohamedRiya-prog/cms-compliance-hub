import { createAdminClient } from '@/lib/supabase/admin'
import { ConsultantsClient } from './consultants-client'

export default async function ConsultantsPage() {
  const db = createAdminClient()

  const { data: reports } = await db
    .from('compliance_reports')
    .select('id, product_family, summary, created_at, projects!inner(id, name, consultant)')
    .not('status', 'in', '("generating","error")')

  const { data: failingRows } = await db
    .from('compliance_rows')
    .select('compliance_reports!inner(id, product_family)')
    .in('status', ['not_comply', 'noted'])

  type ReportRow = {
    id: string
    product_family: string
    summary: { total?: number; comply?: number; notComply?: number; noted?: number } | null
    created_at: string
    projects: { id: string; name: string; consultant: string | null }
  }
  type FailingRow = {
    compliance_reports: { id: string; product_family: string }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportsArr = ((reports ?? []) as unknown as any[]) as ReportRow[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowsArr = ((failingRows ?? []) as unknown as any[]) as FailingRow[]

  // reportId → consultant name (for failing-row cross-ref)
  const reportConsultantMap = new Map(
    reportsArr.map(r => [r.id, r.projects.consultant?.trim() || 'No Consultant'])
  )

  type ProjectDetail = {
    projectId: string
    projectName: string
    reports: number
    totalClauses: number
    comply: number
    notComply: number
    noted: number
    lastActivity: string
  }

  const consultantMap = new Map<string, {
    consultant: string
    projectMap: Map<string, ProjectDetail>
    reports: number
    totalClauses: number
    comply: number
    notComply: number
    noted: number
    familyFails: Map<string, number>
    lastActivity: string
  }>()

  for (const r of reportsArr) {
    const cName = r.projects.consultant?.trim() || 'No Consultant'

    if (!consultantMap.has(cName)) {
      consultantMap.set(cName, {
        consultant: cName,
        projectMap: new Map(),
        reports: 0,
        totalClauses: 0,
        comply: 0,
        notComply: 0,
        noted: 0,
        familyFails: new Map(),
        lastActivity: r.created_at,
      })
    }
    const entry = consultantMap.get(cName)!

    entry.reports++
    entry.totalClauses += r.summary?.total    ?? 0
    entry.comply       += r.summary?.comply   ?? 0
    entry.notComply    += r.summary?.notComply ?? 0
    entry.noted        += r.summary?.noted     ?? 0
    if (r.created_at > entry.lastActivity) entry.lastActivity = r.created_at

    const pid = r.projects.id
    if (!entry.projectMap.has(pid)) {
      entry.projectMap.set(pid, {
        projectId:   pid,
        projectName: r.projects.name,
        reports:     0,
        totalClauses: 0,
        comply:      0,
        notComply:   0,
        noted:       0,
        lastActivity: r.created_at,
      })
    }
    const proj = entry.projectMap.get(pid)!
    proj.reports++
    proj.totalClauses += r.summary?.total    ?? 0
    proj.comply       += r.summary?.comply   ?? 0
    proj.notComply    += r.summary?.notComply ?? 0
    proj.noted        += r.summary?.noted     ?? 0
    if (r.created_at > proj.lastActivity) proj.lastActivity = r.created_at
  }

  // Tally failing product families per consultant
  for (const row of rowsArr) {
    const consultant = reportConsultantMap.get(row.compliance_reports.id)
    if (!consultant) continue
    const entry = consultantMap.get(consultant)
    if (!entry) continue
    const fam = row.compliance_reports.product_family
    entry.familyFails.set(fam, (entry.familyFails.get(fam) ?? 0) + 1)
  }

  const consultants = Array.from(consultantMap.values())
    .map(c => ({
      consultant: c.consultant,
      projects:   c.projectMap.size,
      reports:    c.reports,
      totalClauses: c.totalClauses,
      comply:     c.comply,
      notComply:  c.notComply,
      noted:      c.noted,
      complianceRate: c.totalClauses > 0
        ? Math.round((c.comply / c.totalClauses) * 100) : 0,
      topFailingFamilies: Array.from(c.familyFails.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([fam]) => fam),
      lastActivity: c.lastActivity,
      projectDetails: Array.from(c.projectMap.values())
        .map(p => ({
          ...p,
          complianceRate: p.totalClauses > 0
            ? Math.round((p.comply / p.totalClauses) * 100) : 0,
        }))
        .sort((a, b) => b.complianceRate - a.complianceRate),
    }))
    .sort((a, b) => b.complianceRate - a.complianceRate)

  return <ConsultantsClient consultants={consultants} />
}
