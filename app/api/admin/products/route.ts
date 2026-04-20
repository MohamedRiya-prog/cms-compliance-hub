import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('product_data')
    .select('id, family, label, product_group, division, version, updated_at')
    .order('family')

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { family, label, product_group, division, content } = await req.json()
  if (!family?.trim()) return NextResponse.json({ error: 'family code is required' }, { status: 400 })
  if (!label?.trim())  return NextResponse.json({ error: 'label is required' }, { status: 400 })

  const code = (family as string).trim().toUpperCase().replace(/\s+/g, '_')

  const admin = createAdminClient()

  // Check duplicate
  const { data: existing } = await admin
    .from('product_data')
    .select('id')
    .eq('family', code)
    .limit(1)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: `Product code "${code}" already exists` }, { status: 409 })

  const { data, error } = await admin
    .from('product_data')
    .insert({
      family: code,
      label: label.trim(),
      product_group: product_group?.trim() || 'Custom',
      division: division?.trim() || 'GD & ACC',
      content: content ?? '',
      version: 1,
      updated_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
