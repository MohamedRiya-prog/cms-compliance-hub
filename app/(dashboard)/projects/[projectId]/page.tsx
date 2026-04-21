import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ProjectDetailClient } from './project-detail-client'

const PROJECT_SELECT = `
  *,
  spec_documents(id, file_name, file_type, file_size, uploaded_at),
  compliance_reports(
    id, title, product_family, product_model, status, summary, created_at, updated_at, spec_document_id, revision, verified_by,
    compliance_rows(id, sort_order, clause, requirement, product_response, status, remark)
  )
`

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, divisions')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'
  const userDivisions: string[] = (profile as { divisions?: string[] | null } | null)?.divisions ?? []

  const adminDb = createAdminClient()
  const { data: project } = await adminDb
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  // Non-admins can only view projects in their division
  const projectDivision = (project as { division?: string | null }).division
  if (!isAdmin && (!projectDivision || !userDivisions.includes(projectDivision))) notFound()

  // Batch-fetch names for project creator + all report verifiers
  type ProjectRow = { user_id?: string; compliance_reports?: Array<{ verified_by?: string | null }> }
  const typedProject = project as unknown as ProjectRow
  const profileIds = new Set<string>()
  if (typedProject.user_id) profileIds.add(typedProject.user_id)
  for (const r of typedProject.compliance_reports ?? []) {
    if (r.verified_by) profileIds.add(r.verified_by)
  }
  let profileNames: Record<string, string> = {}
  if (profileIds.size > 0) {
    const { data: profiles } = await adminDb
      .from('profiles')
      .select('id, full_name')
      .in('id', [...profileIds])
    profileNames = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? 'Unknown'])
    )
  }

  return <ProjectDetailClient project={project} isAdmin={isAdmin} profileNames={profileNames} />
}
