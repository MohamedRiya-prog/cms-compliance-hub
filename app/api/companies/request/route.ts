import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  // Resolve requester names via profiles
  const userIds = [...new Set(rows.map((r: { requested_by: string | null }) => r.requested_by).filter(Boolean))]
  let profileMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    profileMap = new Map((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? '']))
  }

  const result = rows.map((r: { requested_by: string | null }) => ({
    ...r,
    profiles: r.requested_by ? { full_name: profileMap.get(r.requested_by) ?? null } : null,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = z.object({
    name:    z.string().min(1).max(200),
    types:   z.array(z.enum(['contractor', 'main_contractor', 'consultant'])).min(1),
    city:    z.string().max(100).optional(),
    country: z.string().max(100).optional(),
  }).safeParse(body)

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, types, city, country } = parsed.data
  const admin = createAdminClient()
  const { error } = await admin.from('company_requests').insert({
    name: name.trim(),
    types,
    city:         city ?? null,
    country:      country ?? null,
    requested_by: user.id,
    status:       'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
