import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import ExcelJS from 'exceljs'

const STATUS_COLORS: Record<string, string> = {
  comply:               'FFC6EFCE',
  not_comply:           'FFFFC7CE',
  noted:                'FFFFEB9C',
  not_part_of_proposal: 'FFD9D9D9',
  header:               'FFD6E4F0',
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    comply:               'Comply',
    not_comply:           'Not Comply',
    noted:                'Noted',
    not_part_of_proposal: 'Not Part of Proposal',
    header:               '',
  }
  return map[status] ?? status
}

const COL_BORDER = {
  top:    { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
  left:   { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
  right:  { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
}

type ComplianceRow = {
  sort_order: number
  clause: string
  requirement: string
  product_response: string
  status: string
  remark: string
}

type ReportData = {
  id: string
  title: string
  product_family: string
  revision: number
  summary: Record<string, number> | null
  created_at: string
  verified_by: string | null
  compliance_rows: ComplianceRow[]
}

type ProjectMeta = {
  name: string
  client: string | null
  location: string | null
  project_number: string | null
  contractor: string | null
  main_contractor: string | null
  consultant: string | null
  user_id: string
}

/** Builds a single-sheet workbook with project header, all reports, and footer */
function buildWorkbook(
  projectMeta: ProjectMeta,
  reports: ReportData[],
  profileMap: Map<string, string>
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CMS Compliance Hub'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Compliance Report')
  sheet.columns = [
    { key: 'clause',          width: 14 },
    { key: 'requirement',     width: 50 },
    { key: 'productResponse', width: 44 },
    { key: 'status',          width: 22 },
    { key: 'remark',          width: 44 },
  ]

  const NCOLS = 5
  let rowIdx = 1

  // ── Project header block ─────────────────────────────────────────────────
  // Row 1: Project name (full-width, blue)
  const titleRow = sheet.getRow(rowIdx++)
  titleRow.getCell(1).value = projectMeta.name
  titleRow.getCell(1).font  = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  titleRow.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
  titleRow.height = 26
  sheet.mergeCells(`A${rowIdx - 1}:E${rowIdx - 1}`)

  // Row 2: detail fields (light grey)
  const details: string[] = [
    projectMeta.client         ? `Client: ${projectMeta.client}`              : '',
    projectMeta.location       ? `Location: ${projectMeta.location}`          : '',
    projectMeta.project_number ? `Ref: #${projectMeta.project_number}`        : '',
    (projectMeta.main_contractor || projectMeta.contractor)
      ? `Contractor: ${projectMeta.main_contractor ?? projectMeta.contractor}` : '',
    projectMeta.consultant     ? `Consultant: ${projectMeta.consultant}`      : '',
  ].filter(Boolean)

  const detailRow = sheet.getRow(rowIdx++)
  details.forEach((val, i) => {
    detailRow.getCell(i + 1).value = val
    detailRow.getCell(i + 1).font  = { size: 9, color: { argb: 'FF555555' } }
    detailRow.getCell(i + 1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EFF7' } }
    detailRow.getCell(i + 1).alignment = { vertical: 'middle' }
  })
  detailRow.height = 18

  // Spacer
  sheet.getRow(rowIdx++).height = 6

  // ── Column header row ────────────────────────────────────────────────────
  const colHdrRow = sheet.getRow(rowIdx++)
  const colHdrs   = ['Clause', 'Requirement', 'Product Response', 'Status', 'Remark']
  colHdrs.forEach((h, i) => {
    const cell = colHdrRow.getCell(i + 1)
    cell.value = h
    cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF1F5C99' } },
      bottom: { style: 'thin', color: { argb: 'FF1F5C99' } },
      left:   { style: 'thin', color: { argb: 'FF1F5C99' } },
      right:  { style: 'thin', color: { argb: 'FF1F5C99' } },
    }
  })
  colHdrRow.height = 22

  // Freeze rows above data
  sheet.views = [{ state: 'frozen', ySplit: rowIdx - 1 }]

  // ── Reports ──────────────────────────────────────────────────────────────
  for (const report of reports) {
    const complianceRows = [...report.compliance_rows].sort((a, b) => a.sort_order - b.sort_order)
    const revLabel = `Revision-${String(report.revision ?? 0).padStart(2, '0')}`

    // Report divider row
    const divRow = sheet.getRow(rowIdx++)
    divRow.getCell(1).value = `${report.product_family}  —  ${report.title}  (${revLabel})`
    divRow.getCell(1).font  = { bold: true, size: 10, color: { argb: 'FF1F5C99' } }
    divRow.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
    divRow.getCell(1).alignment = { vertical: 'middle' }
    divRow.getCell(1).border = {
      left:   { style: 'medium', color: { argb: 'FF2E75B6' } },
      bottom: { style: 'thin',   color: { argb: 'FFADC8E0' } },
    }
    // Fill remaining cells in divider
    for (let c = 2; c <= NCOLS; c++) {
      const cell = divRow.getCell(c)
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFADC8E0' } } }
    }
    sheet.mergeCells(`A${rowIdx - 1}:E${rowIdx - 1}`)
    divRow.height = 20

    // Compliance rows
    for (const row of complianceRows) {
      const dataRow = sheet.getRow(rowIdx++)
      dataRow.getCell(1).value = row.clause
      dataRow.getCell(2).value = row.requirement
      dataRow.getCell(3).value = row.product_response ?? ''
      dataRow.getCell(4).value = formatStatus(row.status)
      dataRow.getCell(5).value = row.remark ?? ''

      const fillColor = STATUS_COLORS[row.status] ?? 'FFFFFFFF'
      for (let c = 1; c <= NCOLS; c++) {
        const cell = dataRow.getCell(c)
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
        cell.font      = row.status === 'header' ? { bold: true, size: 9 } : { size: 9 }
        cell.border    = COL_BORDER
      }
    }

    // Per-report summary row
    const s = report.summary
    if (s) {
      const sumRow = sheet.getRow(rowIdx++)
      const total  = s.total ?? 0
      const comply = s.comply ?? 0
      const rate   = total > 0 ? `${Math.round((comply / total) * 100)}%` : '—'
      sumRow.getCell(1).value = `Total: ${total}`
      sumRow.getCell(2).value = `Comply: ${comply}`
      sumRow.getCell(3).value = `Not Comply: ${s.notComply ?? 0}  |  Noted: ${s.noted ?? 0}`
      sumRow.getCell(4).value = `Not Part of Proposal: ${s.notPartOfProposal ?? 0}`
      sumRow.getCell(5).value = `Rate: ${rate}`
      for (let c = 1; c <= NCOLS; c++) {
        const cell = sumRow.getCell(c)
        cell.font      = { bold: true, size: 9 }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border    = COL_BORDER
      }
      sumRow.height = 16
    }

    // Spacer between reports
    sheet.getRow(rowIdx++).height = 6
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const createdByName  = profileMap.get(projectMeta.user_id) ?? 'Unknown'
  // Use the most recent verified_by across all reports (last verified report wins)
  let verifiedByName: string | null = null
  let latestVerified: string | null = null
  for (const r of reports) {
    if (r.verified_by && (!latestVerified || r.created_at > latestVerified)) {
      verifiedByName = profileMap.get(r.verified_by) ?? null
      latestVerified = r.created_at
    }
  }

  const footerRow = sheet.getRow(rowIdx)
  footerRow.getCell(1).value = `Created by: ${createdByName}`
  footerRow.getCell(2).value = `Exported: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
  footerRow.getCell(4).value = verifiedByName ? `Verified by: ${verifiedByName}` : 'Not yet verified'
  for (let c = 1; c <= NCOLS; c++) {
    const cell = footerRow.getCell(c)
    cell.font      = { italic: true, size: 9, color: { argb: 'FF666666' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }
    cell.alignment = { vertical: 'middle' }
  }
  footerRow.height = 18

  return workbook
}

// ── Project-level export ─────────────────────────────────────────────────────
async function exportProject(req: NextRequest, projectId: string) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, role, isAdmin, supabase } = ctx

  const db = isAdmin ? createAdminClient() : supabase
  let projectQuery = db
    .from('projects')
    .select('id, name, client, location, project_number, contractor, main_contractor, consultant, user_id')
    .eq('id', projectId)
  if (!isAdmin) projectQuery = projectQuery.eq('user_id', user.id)
  const { data: project } = await projectQuery.single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Coordinators can only export verified or admin-approved reports
  const statusFilter = role === 'coordinator'
    ? '("generating","error","review","pending_verification","needs_revision")'
    : '("generating","error")'

  const { data: allReports } = await db
    .from('compliance_reports')
    .select('id, title, product_family, revision, summary, created_at, verified_by, compliance_rows(*)')
    .eq('project_id', projectId)
    .not('status', 'in', statusFilter)
    .order('revision', { ascending: true })

  if (!allReports || allReports.length === 0) {
    return NextResponse.json({ error: 'No reports found' }, { status: 404 })
  }

  // Keep only the latest revision per product_family
  const latestMap = new Map<string, typeof allReports[number]>()
  for (const r of allReports) {
    latestMap.set((r as { product_family: string }).product_family, r)
  }
  const reports = Array.from(latestMap.values()) as unknown as ReportData[]

  // Look up creator + verifier names
  const adminDb = createAdminClient()
  const profileIds = [
    (project as { user_id: string }).user_id,
    ...reports.map(r => r.verified_by).filter(Boolean),
  ]
  const { data: profileRows } = await adminDb
    .from('profiles')
    .select('id, full_name')
    .in('id', [...new Set(profileIds)])
  const profileMap = new Map(
    (profileRows ?? []).map(p => [p.id, (p.full_name as string | null) ?? 'Unknown'])
  )

  const pj = project as unknown as ProjectMeta
  const workbook = buildWorkbook(pj, reports, profileMap)

  const buffer   = await workbook.xlsx.writeBuffer()
  const safeName = pj.name.replace(/[^a-z0-9]/gi, '_')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}_Compliance.xlsx"`,
    },
  })
}

// ── Single-report export ─────────────────────────────────────────────────────
async function exportReport(req: NextRequest, reportId: string) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, role, isAdmin, supabase } = ctx

  const { data: report } = await supabase
    .from('compliance_reports')
    .select('*, projects!inner(id, name, client, location, project_number, contractor, main_contractor, consultant, user_id), compliance_rows(*)')
    .eq('id', reportId)
    .single()

  const r = report as unknown as ReportData & {
    status: string
    projects: ProjectMeta & { id: string }
  }
  if (!r || (!isAdmin && r.projects?.user_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (role === 'coordinator' && !['verified', 'approved'].includes(r.status)) {
    return NextResponse.json(
      { error: 'This report must be verified by a Technical Engineer before it can be exported.' },
      { status: 403 }
    )
  }

  // Look up creator + verifier names
  const adminDb = createAdminClient()
  const profileIds = [r.projects.user_id, ...(r.verified_by ? [r.verified_by] : [])]
  const { data: profileRows } = await adminDb
    .from('profiles')
    .select('id, full_name')
    .in('id', profileIds)
  const profileMap = new Map(
    (profileRows ?? []).map(p => [p.id, (p.full_name as string | null) ?? 'Unknown'])
  )

  const workbook = buildWorkbook(r.projects, [r], profileMap)

  const buffer   = await workbook.xlsx.writeBuffer()
  const fileName = `${r.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const reportId  = searchParams.get('reportId')

  if (projectId) return exportProject(req, projectId)
  if (reportId)  return exportReport(req, reportId)
  return NextResponse.json({ error: 'projectId or reportId required' }, { status: 400 })
}
