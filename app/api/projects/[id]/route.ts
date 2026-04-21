import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { z } from 'zod'

/** Check if a non-admin user has division access to a given project. */
async function hasDivisionAccess(projectId: string, userDivisions: string[]): Promise<boolean> {
  if (userDivisions.length === 0) return false
  const adminDb = createAdminClient()
  const { data } = await adminDb
    .from('projects')
    .select('division')
    .eq('id', projectId)
    .single()
  const projectDivision = (data as { division?: string | null } | null)?.division
  return projectDivision != null && userDivisions.includes(projectDivision)
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  division: z.string().min(1).optional(),
  client: z.string().optional(),
  location: z.string().optional(),
  projectNumber: z.string().optional(),
  description: z.string().optional(),
  contractor: z.string().optional(),
  mainContractor: z.string().optional(),
  consultant: z.string().optional(),
  status: z.enum(['active', 'archived']).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { isAdmin, isManagement, divisions } = ctx

  if (!isAdmin && !isManagement && !(await hasDivisionAccess(id, divisions))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('projects')
    .select(`
      *,
      spec_documents(*),
      compliance_reports(
        id, title, product_family, product_model, status, summary, created_at, updated_at,
        compliance_rows(id)
      )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Only admins can modify project details.' }, { status: 403 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('projects')
    .update({
      ...parsed.data,
      project_number: parsed.data.projectNumber,
      main_contractor: parsed.data.mainContractor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Only admins can delete projects.' }, { status: 403 })

  const adminDb = createAdminClient()
  const { error } = await adminDb
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
