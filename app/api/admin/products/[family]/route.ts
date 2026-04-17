import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateCache } from '@/lib/prompt-builder'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ family: string }> }
) {
  const { family } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('product_data')
    .select('*')
    .eq('family', family)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ family: string }> }
) {
  const { family } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { content } = await req.json()
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('product_data')
    .select('version')
    .eq('family', family)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await admin
    .from('product_data')
    .insert({
      family,
      content,
      version: (existing?.version ?? 0) + 1,
      updated_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  invalidateCache()
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ family: string }> }
) {
  const { family } = await params
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Only allow deleting custom products (those with a label stored in DB)
  const { data: existing } = await admin
    .from('product_data')
    .select('label')
    .eq('family', family)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!existing.label) return NextResponse.json({ error: 'Built-in products cannot be deleted' }, { status: 400 })

  const { error } = await admin.from('product_data').delete().eq('family', family)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  invalidateCache()
  return NextResponse.json({ deleted: true })
}
