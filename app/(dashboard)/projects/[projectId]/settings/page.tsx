import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { ProjectSettingsClient } from './project-settings-client'

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  if (!ctx.isAdmin) redirect(`/projects/${projectId}`)

  const adminDb = createAdminClient()
  const { data: project } = await adminDb
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) notFound()
  return <ProjectSettingsClient project={project} />
}
