import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth'

const updateSchema = z.object({
  status: z.enum(['generating', 'review', 'pending_verification', 'verified', 'needs_revision', 'approved', 'exported']).optional(),
  title: z.string().optional(),
  verificationNote: z.string().nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, isAdmin, db } = ctx

  const { data } = await db
    .from('compliance_reports')
    .select(`*, projects!inner(user_id), compliance_rows(*)`)
    .eq('id', reportId)
    .single()

  const typed = data as unknown as { projects: { user_id: string } }
  if (!typed || (!isAdmin && typed.projects?.user_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, isAdmin, db } = ctx

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { role } = ctx

  const { data: report } = await db
    .from('compliance_reports')
    .select('id, status, projects!inner(user_id)')
    .eq('id', reportId)
    .single()

  const typed = report as unknown as { id: string; status: string; projects: { user_id: string } }
  if (!typed || (!isAdmin && typed.projects?.user_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Coordinators can only send for verification (review → pending_verification)
  // or re-submit after revision (needs_revision → pending_verification)
  if (role === 'coordinator' && parsed.data.status && parsed.data.status !== 'pending_verification') {
    return NextResponse.json({ error: 'Coordinators can only submit for verification' }, { status: 403 })
  }

  const { verificationNote, ...rest } = parsed.data
  const updatePayload: Record<string, unknown> = {
    ...rest,
    updated_at: new Date().toISOString(),
  }
  if (verificationNote !== undefined) updatePayload.verification_note = verificationNote

  const { data, error } = await db
    .from('compliance_reports')
    .update(updatePayload)
    .eq('id', reportId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, isAdmin, db } = ctx

  const { data: report } = await db
    .from('compliance_reports')
    .select('id, project_id, projects!inner(user_id)')
    .eq('id', reportId)
    .single()

  const typed = report as unknown as { id: string; project_id: string; projects: { user_id: string } }
  if (!typed || (!isAdmin && typed.projects?.user_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.from('chat_messages').delete().eq('report_id', reportId)
  await db.from('compliance_rows').delete().eq('report_id', reportId)
  const { error } = await db.from('compliance_reports').delete().eq('id', reportId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true, projectId: typed.project_id })
}
