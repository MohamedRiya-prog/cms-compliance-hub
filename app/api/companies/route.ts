import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search  = searchParams.get('search')?.trim() ?? ''
  const type    = searchParams.get('type') ?? ''
  const country = searchParams.get('country')?.trim() ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit    = Math.min(1000, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10))
  const from     = (page - 1) * limit
  const to       = from + limit - 1

  const admin = createAdminClient()
  let query = admin
    .from('companies')
    .select('id, name, types, city, country', { count: 'exact' })
    .order('name')
    .range(from, to)

  if (search)  query = query.ilike('name', `%${search}%`)
  if (country) query = query.ilike('country', `%${country}%`)
  if (type)    query = query.contains('types', [type])

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = z.object({
    name: z.string().min(1).max(200),
    types: z.array(z.enum(['contractor', 'main_contractor', 'consultant'])).min(1),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
  }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, types, city, country } = parsed.data
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .insert({ name: name.trim(), types, city: city ?? null, country: country ?? null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Company already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
