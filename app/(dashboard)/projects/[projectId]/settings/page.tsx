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
  const [{ data: project }, { data: divisionRows }] = await Promise.all([
    adminDb.from('projects').select('*').eq('id', projectId).single(),
    adminDb.from('divisions').select('name').order('name'),
  ])

  if (!project) notFound()
  const availableDivisions = (divisionRows ?? []).map((d: { name: string }) => d.name)
  return <ProjectSettingsClient project={project} availableDivisions={availableDivisions} />
}
