import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

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
    .select('id, projects!inner(user_id)')
    .eq('id', reportId)
    .single()

  const typed = report as unknown as { id: string; projects: { user_id: string } }
  if (!typed || (!isAdmin && typed.projects?.user_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await db
    .from('chat_messages')
    .delete()
    .eq('report_id', reportId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cleared: true })
}
