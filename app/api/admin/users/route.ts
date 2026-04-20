import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminDb = createAdminClient()
  const [{ data: authData }, { data: profiles }] = await Promise.all([
    adminDb.auth.admin.listUsers({ perPage: 1000 }),
    adminDb.from('profiles').select('id, full_name, role, divisions'),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p as { id: string; full_name: string | null; role: string | null; divisions: string[] | null }]))

  const users = (authData?.users ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '',
    fullName: profileMap.get(u.id)?.full_name ?? null,
    role: profileMap.get(u.id)?.role ?? 'coordinator',
    divisions: profileMap.get(u.id)?.divisions ?? [],
    createdAt: u.created_at,
    lastSignIn: u.last_sign_in_at ?? null,
  }))

  return NextResponse.json(users)
}

const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'coordinator', 'engineer']).optional(),
  divisions: z.array(z.string()).optional(),
}).refine(d => d.role !== undefined || d.divisions !== undefined, {
  message: 'role or divisions is required',
})

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { userId, role, divisions } = parsed.data
  const update: Record<string, unknown> = {}
  if (role !== undefined) update.role = role
  if (divisions !== undefined) update.divisions = divisions

  const adminDb = createAdminClient()
  const { error } = await adminDb.from('profiles').update(update).eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
