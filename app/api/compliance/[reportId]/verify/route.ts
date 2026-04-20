import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const schema = z.object({
  action: z.enum(['verify', 'request_changes']),
  note: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, role, isAdmin } = ctx

  // Only engineers and admins can verify
  if (!isAdmin && role !== 'engineer') {
    return NextResponse.json({ error: 'Only engineers can verify reports' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Use admin client — engineers may not own the project
  const adminDb = createAdminClient()

  const { data: report } = await adminDb
    .from('compliance_reports')
    .select('id, status')
    .eq('id', reportId)
    .single()

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const typedReport = report as unknown as { id: string; status: string }
  if (typedReport.status !== 'pending_verification') {
    return NextResponse.json({ error: 'Report is not awaiting verification' }, { status: 400 })
  }

  const { action, note } = parsed.data
  const now = new Date().toISOString()

  const updateData =
    action === 'verify'
      ? {
          status: 'verified',
          verified_by: user.id,
          verified_at: now,
          verification_note: null,
          updated_at: now,
        }
      : {
          status: 'needs_revision',
          verified_by: user.id,
          verified_at: now,
          verification_note: note ?? null,
          updated_at: now,
        }

  const { data, error } = await adminDb
    .from('compliance_reports')
    .update(updateData)
    .eq('id', reportId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
