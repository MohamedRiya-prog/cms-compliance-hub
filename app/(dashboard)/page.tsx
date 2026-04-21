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
    .select('full_name, role, divisions')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const userDivisions: string[] = (profile as { divisions?: string[] | null } | null)?.divisions ?? []
  const adminDb = createAdminClient()

  if (isAdmin) {
    // Admin sees all projects across all users
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
        userDivisions={userDivisions}
      />
    )
  }

  // Non-admins: show all projects in their division(s)
  const projects = userDivisions.length > 0
    ? (await adminDb
        .from('projects')
        .select(`*, compliance_reports(id, status, product_family, summary, created_at)`)
        .in('division', userDivisions)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
      ).data ?? []
    : []

  return (
    <DashboardClient
      userName={profile?.full_name ?? user.email?.split('@')[0] ?? 'there'}
      projects={projects}
      userDivisions={userDivisions}
    />
  )
}
