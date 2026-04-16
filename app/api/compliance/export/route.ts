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

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const reportId = searchParams.get('reportId')
  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

  const { data: report } = await supabase
    .from('compliance_reports')
    .select(`
      *,
      projects!inner(user_id, name, client),
      compliance_rows(*)
    `)
    .eq('id', reportId)
    .single()

  const reportWithProject = report as unknown as {
    id: string; title: string; product_family: string; summary: Record<string, number> | null;
    projects: { user_id: string; name: string; client: string };
    compliance_rows: Array<{ sort_order: number; clause: string; requirement: string; product_response: string; status: string; remark: string }>;
  }

  if (!reportWithProject || reportWithProject.projects?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rows = [...(reportWithProject.compliance_rows ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CMS Compliance Hub'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(reportWithProject.title.slice(0, 30))

  sheet.columns = [
    { header: 'Clause', key: 'clause', width: 14 },
    { header: 'Requirement', key: 'requirement', width: 48 },
    { header: 'Product Response', key: 'productResponse', width: 42 },
    { header: 'Status', key: 'status', width: 22 },
    { header: 'Remark', key: 'remark', width: 42 },
  ]

  // Header row styling
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

  // Data rows
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

  // Summary rows
  const summary = reportWithProject.summary
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

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = `${reportWithProject.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
