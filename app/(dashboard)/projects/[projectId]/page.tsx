import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ProjectDetailClient } from './project-detail-client'

const PROJECT_SELECT = `
  *,
  spec_documents(id, file_name, file_type, file_size, uploaded_at),
  compliance_reports(
    id, title, product_family, product_model, status, summary, created_at, updated_at, spec_document_id, revision,
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
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  let project
  if (isAdmin) {
    const adminDb = createAdminClient()
    const { data } = await adminDb
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', projectId)
      .single()
    project = data
  } else {
    const { data } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()
    project = data
  }

  if (!project) notFound()

  return <ProjectDetailClient project={project} isAdmin={isAdmin} />
}
