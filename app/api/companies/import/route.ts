import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const VALID_TYPES = ['contractor', 'main_contractor', 'consultant'] as const

const rowSchema = z.object({
  name:    z.string().min(1).max(200),
  city:    z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  types:   z.array(z.enum(VALID_TYPES)).default([]),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!Array.isArray(body.rows)) return NextResponse.json({ error: 'rows array required' }, { status: 400 })

  const rows: { name: string; city: string | null; country: string | null; types: string[] }[] = []
  const errors: string[] = []

  for (let i = 0; i < body.rows.length; i++) {
    const parsed = rowSchema.safeParse(body.rows[i])
    if (!parsed.success) {
      errors.push(`Row ${i + 1}: ${parsed.error.issues[0].message}`)
    } else {
      rows.push({
        name:    parsed.data.name.trim(),
        city:    parsed.data.city?.trim() || null,
        country: parsed.data.country?.trim() || null,
        types:   parsed.data.types,
      })
    }
  }

  if (rows.length === 0) return NextResponse.json({ error: 'No valid rows', errors }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('companies')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ imported: rows.length, errors })
}
