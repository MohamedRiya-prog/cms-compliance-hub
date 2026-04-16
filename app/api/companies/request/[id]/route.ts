import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch the request
  const { data: request, error: fetchErr } = await admin
    .from('company_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Create the company
  const { data: company, error: insertErr } = await admin
    .from('companies')
    .insert({ name: request.name, types: request.types, city: request.city, country: request.country })
    .select()
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') return NextResponse.json({ error: 'Company already exists' }, { status: 409 })
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Mark request as approved
  await admin.from('company_requests').update({ status: 'approved' }).eq('id', id)

  return NextResponse.json(company)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()
  await admin.from('company_requests').update({ status: 'rejected' }).eq('id', id)

  return new NextResponse(null, { status: 204 })
}
