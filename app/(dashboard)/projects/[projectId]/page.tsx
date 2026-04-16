import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProjectDetailClient } from './project-detail-client'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      spec_documents(id, file_name, file_type, file_size, uploaded_at),
      compliance_reports(
        id, title, product_family, product_model, status, summary, created_at, updated_at,
        compliance_rows(id)
      )
    `)
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  return <ProjectDetailClient project={project} />
}
