import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['generating', 'review', 'approved', 'exported']).optional(),
  title: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('compliance_reports')
    .select(`*, projects!inner(user_id), compliance_rows(*)`)
    .eq('id', reportId)
    .single()

  const typedData = data as unknown as { projects: { user_id: string } }
  if (!typedData || typedData.projects?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data: report } = await supabase
    .from('compliance_reports')
    .select('id, projects!inner(user_id)')
    .eq('id', reportId)
    .single()

  const typedReport = report as unknown as { id: string; projects: { user_id: string } }
  if (!typedReport || typedReport.projects?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('compliance_reports')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', reportId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
