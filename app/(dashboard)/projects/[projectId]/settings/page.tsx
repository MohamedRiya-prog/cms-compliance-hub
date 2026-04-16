import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProjectSettingsClient } from './project-settings-client'

export default async function ProjectSettingsPage({
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
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()
  return <ProjectSettingsClient project={project} />
}
