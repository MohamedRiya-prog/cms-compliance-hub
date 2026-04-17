import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

const STATUS_COLORS: Record<string, string> = {
  comply: 'FFC6EFCE',
  not_comply: 'FFFFC7CE',
  noted: 'FFFFEB9C',
  not_part_of_proposal: 'FFD9D9D9',
  header: 'FFD6E4F0',
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    comply: 'Comply',
    not_comply: 'Not Comply',
    noted: 'Noted',
    not_part_of_proposal: 'Not Part of Proposal',
    header: '',
  }
  return map[status] ?? status
}

type ComplianceRow = {
  sort_order: number
  clause: string
  requirement: string
  product_response: string
  status: string
  remark: string
}

type ReportWithRows = {
  id: string
  title: string
  product_family: string
  summary: Record<string, number> | null
  compliance_rows: ComplianceRow[]
}

function addReportSheet(
  workbook: ExcelJS.Workbook,
  report: ReportWithRows,
  sheetName: string
) {
  const rows = [...(report.compliance_rows ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const sheet = workbook.addWorksheet(sheetName)

  sheet.columns = [
    { header: 'Clause', key: 'clause', width: 14 },
    { header: 'Requirement', key: 'requirement', width: 48 },
    { header: 'Product Response', key: 'productResponse', width: 42 },
    { header: 'Status', key: 'status', width: 22 },
    { header: 'Remark', key: 'remark', width: 42 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.height = 22
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1F5C99' } },
      bottom: { style: 'thin', color: { argb: 'FF1F5C99' } },
      left: { style: 'thin', color: { argb: 'FF1F5C99' } },
      right: { style: 'thin', color: { argb: 'FF1F5C99' } },
    }
  })

  for (const row of rows) {
    const excelRow = sheet.addRow({
      clause: row.clause,
      requirement: row.requirement,
      productResponse: row.product_response ?? '',
      status: formatStatus(row.status),
      remark: row.remark ?? '',
    })

    const fillColor = STATUS_COLORS[row.status] ?? 'FFFFFFFF'
    excelRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
      cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
      cell.font = { size: 9 }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      }
    })

    if (row.status === 'header') {
      excelRow.font = { bold: true, size: 9 }
    }
  }

  const summary = report.summary
  if (summary) {
    sheet.addRow([])
    const summaryRow = sheet.addRow([
      `Total clauses: ${summary.total ?? 0}`,
      `Comply: ${summary.comply ?? 0}`,
      `Not Comply: ${summary.notComply ?? 0}`,
      `Noted: ${summary.noted ?? 0}`,
      `Not Part of Proposal: ${summary.notPartOfProposal ?? 0}`,
    ])
    summaryRow.eachCell(cell => {
      cell.font = { bold: true, size: 9 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

// ── Project-level export (all reports, one sheet each + summary) ─────────────
async function exportProject(req: NextRequest, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, client, project_number')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data: allReports } = await supabase
    .from('compliance_reports')
    .select(`id, title, product_family, revision, summary, compliance_rows(*)`)
    .eq('project_id', projectId)
    .not('status', 'in', '("generating","error")')
    .order('revision', { ascending: true })

  if (!allReports || allReports.length === 0) {
    return NextResponse.json({ error: 'No reports found' }, { status: 404 })
  }

  // Keep only the latest revision per product_family
  const latestMap = new Map<string, typeof allReports[number]>()
  for (const r of allReports) {
    const key = (r as { product_family: string }).product_family
    latestMap.set(key, r)  // later (higher revision) entries overwrite earlier ones
  }
  const reports = Array.from(latestMap.values())

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CMS Compliance Hub'
  workbook.created = new Date()

  // ── Summary sheet ────────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary')
  summarySheet.columns = [
    { header: 'Report', key: 'title', width: 36 },
    { header: 'Product Family', key: 'family', width: 18 },
    { header: 'Total', key: 'total', width: 9 },
    { header: 'Comply', key: 'comply', width: 9 },
    { header: 'Not Comply', key: 'notComply', width: 12 },
    { header: 'Noted', key: 'noted', width: 9 },
    { header: 'Not Part of Proposal', key: 'notProp', width: 22 },
    { header: 'Rate', key: 'rate', width: 9 },
  ]

  // Project info rows above table
  const projectInfoRow = summarySheet.insertRow(1, [
    project.name,
    project.client ?? '',
    project.project_number ? `#${project.project_number}` : '',
    '',
    '',
    '',
    '',
    `Exported: ${new Date().toLocaleDateString()}`,
  ])
  projectInfoRow.font = { bold: true, size: 11 }
  projectInfoRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
  projectInfoRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  summarySheet.mergeCells('A1:C1')
  summarySheet.addRow([]) // spacer

  // Table header (row 3 now)
  const tableHeaderRow = summarySheet.getRow(3)
  tableHeaderRow.values = ['Report', 'Product Family', 'Total', 'Comply', 'Not Comply', 'Noted', 'Not Part of Proposal', 'Rate']
  tableHeaderRow.height = 22
  tableHeaderRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1F5C99' } },
      bottom: { style: 'thin', color: { argb: 'FF1F5C99' } },
      left: { style: 'thin', color: { argb: 'FF1F5C99' } },
      right: { style: 'thin', color: { argb: 'FF1F5C99' } },
    }
  })

  for (const report of reports as unknown as ReportWithRows[]) {
    const s = report.summary
    const total = s?.total ?? 0
    const comply = s?.comply ?? 0
    const rate = total > 0 ? `${Math.round((comply / total) * 100)}%` : '—'

    const dataRow = summarySheet.addRow({
      title: report.title,
      family: report.product_family,
      total,
      comply,
      notComply: s?.notComply ?? 0,
      noted: s?.noted ?? 0,
      notProp: s?.notPartOfProposal ?? 0,
      rate,
    })
    dataRow.eachCell(cell => {
      cell.font = { size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      }
    })
    dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

    // Colour the Rate cell
    const rateCell = dataRow.getCell(8)
    const rateNum = total > 0 ? Math.round((comply / total) * 100) : -1
    if (rateNum >= 80) rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }
    else if (rateNum >= 50) rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } }
    else if (rateNum >= 0) rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
  }

  summarySheet.views = [{ state: 'frozen', ySplit: 3 }]

  // ── One sheet per report (latest revision only) ──────────────────────────
  const usedNames = new Set<string>()
  for (const report of reports as unknown as (ReportWithRows & { revision?: number })[]) {
    const rev = `R${String(report.revision ?? 0).padStart(2, '0')}`
    let name = `${(report.product_family || report.title).slice(0, 24)} ${rev}`
    if (usedNames.has(name)) name = `${name.slice(0, 25)}_${usedNames.size}`
    usedNames.add(name)
    addReportSheet(workbook, report, name)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const safeName = (project.name ?? 'Project').replace(/[^a-z0-9]/gi, '_')
  const fileName = `${safeName}_Compliance.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}

// ── Single-report export (existing behaviour) ────────────────────────────────
async function exportReport(req: NextRequest, reportId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: report } = await supabase
    .from('compliance_reports')
    .select(`*, projects!inner(user_id, name, client), compliance_rows(*)`)
    .eq('id', reportId)
    .single()

  const r = report as unknown as ReportWithRows & { projects: { user_id: string; name: string } }
  if (!r || r.projects?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CMS Compliance Hub'
  workbook.created = new Date()

  addReportSheet(workbook, r, r.title.slice(0, 30))

  const buffer = await workbook.xlsx.writeBuffer()
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
  const reportId = searchParams.get('reportId')

  if (projectId) return exportProject(req, projectId)
  if (reportId) return exportReport(req, reportId)
  return NextResponse.json({ error: 'projectId or reportId required' }, { status: 400 })
}
