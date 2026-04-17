import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth'

const updateSchema = z.object({
  productResponse: z.string().optional(),
  status: z.enum(['comply', 'not_comply', 'noted', 'not_part_of_proposal', 'header']).optional(),
  remark: z.string().optional(),
  clause: z.string().optional(),
  requirement: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string; rowId: string }> }
) {
  const { reportId, rowId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, isAdmin, db } = ctx

  const { data: report } = await db
    .from('compliance_reports')
    .select('id, projects!inner(user_id)')
    .eq('id', reportId)
    .single()

  const typed = report as unknown as { id: string; projects: { user_id: string } }
  if (!typed || (!isAdmin && typed.projects?.user_id !== user.id)) {
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
