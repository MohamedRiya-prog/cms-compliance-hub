import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  productResponse: z.string().optional(),
  status: z.enum(['comply', 'not_comply', 'noted', 'not_part_of_proposal', 'header']).optional(),
  remark: z.string().optional(),
  clause: z.string().optional(),
  requirement: z.string().optional(),
})

const LOCKED_STATUSES = ['verified', 'approved']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string; rowId: string }> }
) {
  const { reportId, rowId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.isManagement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user, isAdmin, divisions, db } = ctx

  const { data: report } = await db
    .from('compliance_reports')
    .select('id, status, revision, project_id, spec_text, spec_document_id, title, product_family, projects!inner(user_id, division)')
    .eq('id', reportId)
    .single()

  const typed = report as unknown as {
    id: string; status: string; revision: number; project_id: string
    spec_text: string | null; spec_document_id: string | null; title: string; product_family: string
    projects: { user_id: string; division: string | null }
  }
  const hasDivAccess = divisions.length > 0 && typed?.projects?.division != null && divisions.includes(typed.projects.division)
  if (!typed || (!isAdmin && typed.projects?.user_id !== user.id && !hasDivAccess)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updateData: Record<string, unknown> = {
    is_edited: true,
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.productResponse !== undefined) updateData.product_response = parsed.data.productResponse
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status
  if (parsed.data.remark !== undefined) updateData.remark = parsed.data.remark
  if (parsed.data.clause !== undefined) updateData.clause = parsed.data.clause
  if (parsed.data.requirement !== undefined) updateData.requirement = parsed.data.requirement

  // Locked report → auto-fork into a new revision, apply edit there
  if (LOCKED_STATUSES.includes(typed.status)) {
    const adminDb = createAdminClient()
    const nextRevision = (typed.revision ?? 0) + 1

    const { data: newReport, error: forkErr } = await adminDb
      .from('compliance_reports')
      .insert({
        project_id: typed.project_id,
        spec_document_id: typed.spec_document_id,
        title: typed.title,
        product_family: typed.product_family,
        status: 'review',
        spec_text: typed.spec_text,
        revision: nextRevision,
      })
      .select('id')
      .single()

    if (forkErr || !newReport) return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 })
    const newReportId = (newReport as { id: string }).id

    // Copy all rows from original report
    const { data: allRows } = await adminDb
      .from('compliance_rows')
      .select('*')
      .eq('report_id', reportId)
      .order('sort_order')

    const originalRow = (allRows ?? []).find((r: { id: string }) => r.id === rowId)
    const now = new Date().toISOString()
    const rowsToInsert = (allRows ?? []).map(({ id: _id, ...r }: Record<string, unknown>) => ({
      ...r,
      report_id: newReportId,
      updated_at: now,
    }))
    if (rowsToInsert.length > 0) await adminDb.from('compliance_rows').insert(rowsToInsert)

    // Apply the edit to the matching row in the new report (same sort_order)
    if (originalRow) {
      await adminDb
        .from('compliance_rows')
        .update({ ...updateData })
        .eq('report_id', newReportId)
        .eq('sort_order', (originalRow as { sort_order: number }).sort_order)
    }

    return NextResponse.json({ newReportId })
  }

  const { data, error } = await db
    .from('compliance_rows')
    .update(updateData)
    .eq('id', rowId)
    .eq('report_id', reportId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
