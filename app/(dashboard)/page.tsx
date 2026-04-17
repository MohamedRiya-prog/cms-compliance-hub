import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  if (isAdmin) {
    // Admin sees all projects across all users
    const adminDb = createAdminClient()
    const { data: allProjects } = await adminDb
      .from('projects')
      .select(`*, compliance_reports(id, status, product_family, summary, created_at)`)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })

    // Fetch owner profiles for all projects
    const userIds = [...new Set((allProjects ?? []).map((p: { user_id: string }) => p.user_id))]
    const { data: ownerProfiles } = await adminDb
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    const profileMap = new Map((ownerProfiles ?? []).map((p: { id: string; full_name: string; email: string }) => [p.id, p]))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectsWithOwner = ((allProjects ?? []) as any[]).map(p => ({
      ...p,
      ownerName: (profileMap.get(p.user_id) as { full_name?: string; email?: string } | undefined)?.full_name
        ?? (profileMap.get(p.user_id) as { full_name?: string; email?: string } | undefined)?.email
        ?? 'Unknown',
    }))

    return (
      <DashboardClient
        userName={profile?.full_name ?? user.email?.split('@')[0] ?? 'there'}
        projects={projectsWithOwner}
        isAdmin
      />
    )
  }

  const { data: projects } = await supabase
    .from('projects')
    .select(`*, compliance_reports(id, status, product_family, summary, created_at)`)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  return (
    <DashboardClient
      userName={profile?.full_name ?? user.email?.split('@')[0] ?? 'there'}
      projects={projects ?? []}
    />
  )
}
