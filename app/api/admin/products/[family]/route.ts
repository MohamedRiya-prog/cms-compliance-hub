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

  // Resolve updated_by UUID → display name
  let updatedByName: string | null = null
  if (data.updated_by) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', data.updated_by)
      .single()
    updatedByName = (profile as { full_name?: string | null } | null)?.full_name ?? null
  }

  return NextResponse.json({ ...data, updated_by_name: updatedByName })
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

  const { content, division } = await req.json()
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const admin = createAdminClient()

  // Check if a row already exists for this family
  const { data: existing } = await admin
    .from('product_data')
    .select('id')
    .eq('family', family)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const updatePayload: Record<string, unknown> = { content, updated_by: user.id }
  if (division !== undefined) updatePayload.division = division

  let data, error
  if (existing) {
    // Update in-place — no more duplicate rows
    ;({ data, error } = await admin
      .from('product_data')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single())
  } else {
    // First time saving this product — insert one row
    ;({ data, error } = await admin
      .from('product_data')
      .insert({ family, ...updatePayload, version: 1 })
      .select()
      .single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ family: string }> }
) {
  const { family } = await params
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { division } = await req.json()

  const admin = createAdminClient()

  // Check if any row exists for this family
  const { data: existing } = await admin
    .from('product_data')
    .select('id')
    .eq('family', family)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  let result, error
  if (existing) {
    // Update division in-place on the latest row
    ;({ data: result, error } = await admin
      .from('product_data')
      .update({ division: division || null })
      .eq('id', existing.id)
      .select()
      .single())
  } else {
    // Create a stub row with just the division — no content needed
    ;({ data: result, error } = await admin
      .from('product_data')
      .insert({
        family,
        division: division || null,
        content: '',
        version: 1,
        updated_by: user.id,
      })
      .select()
      .single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(result)
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
  return NextResponse.json({ deleted: true })
}
