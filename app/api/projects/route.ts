import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { z } from 'zod'
import { generateProjectNumber } from './next-number/route'

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  division: z.string().min(1),
  client: z.string().optional(),
  location: z.string().optional(),
  projectNumber: z.string().optional(),
  contractor: z.string().optional(),
  mainContractor: z.string().optional(),
  consultant: z.string().optional(),
  description: z.string().optional(),
})

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, isAdmin, isManagement, divisions, supabase } = ctx

  if (isAdmin || isManagement) {
    const adminDb = createAdminClient()
    const { data, error } = await adminDb
      .from('projects')
      .select(`*, compliance_reports(id, status, product_family, created_at)`)
      .order('updated_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Non-admins: see all projects in their division(s)
  if (divisions.length === 0) return NextResponse.json([])

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('projects')
    .select(`*, compliance_reports(id, status, product_family, created_at)`)
    .in('division', divisions)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.isManagement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user, isAdmin, divisions, supabase } = ctx

  const body = await req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, division, client, location, contractor, mainContractor, consultant, description } = parsed.data

  // Non-admins can only create projects in their own division
  if (!isAdmin && !divisions.includes(division)) {
    return NextResponse.json({ error: 'You do not belong to that division.' }, { status: 403 })
  }

  const projectNumber = parsed.data.projectNumber?.trim() || await generateProjectNumber()

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name,
      division,
      client: client ?? null,
      location: location ?? null,
      project_number: projectNumber,
      contractor: contractor ?? null,
      main_contractor: mainContractor ?? null,
      consultant: consultant ?? null,
      description: description ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
