import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth'

const updateSchema = z.object({
  status: z.enum(['generating', 'review', 'approved', 'exported']).optional(),
  title: z.string().optional(),
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

  const { data: report } = await db
    .from('compliance_reports')
    .select('id, projects!inner(user_id)')
    .eq('id', reportId)
    .single()

  const typed = report as unknown as { id: string; projects: { user_id: string } }
  if (!typed || (!isAdmin && typed.projects?.user_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await db
    .from('compliance_reports')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
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
