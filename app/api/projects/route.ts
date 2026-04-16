import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateProjectNumber } from './next-number/route'

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  client: z.string().optional(),
  location: z.string().optional(),
  projectNumber: z.string().optional(),
  contractor: z.string().optional(),
  mainContractor: z.string().optional(),
  consultant: z.string().optional(),
  description: z.string().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      compliance_reports(id, status, product_family, created_at)
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, client, location, contractor, mainContractor, consultant, description } = parsed.data
  const projectNumber = parsed.data.projectNumber?.trim() || await generateProjectNumber()

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name,
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
