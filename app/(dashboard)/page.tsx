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


    // Fetch owner + editor names for all projects
    const allProj = (allProjects ?? []) as Array<{ user_id: string; updated_by: string | null }>
    const userIds = [...new Set([
      ...allProj.map(p => p.user_id),
      ...allProj.map(p => p.updated_by).filter(Boolean) as string[],
    ])]
    const [{ data: ownerProfiles }, { data: authUsers }] = await Promise.all([
      adminDb.from('profiles').select('id, full_name').in('id', userIds),
      adminDb.auth.admin.listUsers({ perPage: 1000 }),
    ])
    const nameMap = new Map((ownerProfiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))
    const emailMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.email ?? '']))

    function resolveUser(id: string | null): string | null {
      if (!id) return null
      return nameMap.get(id) || emailMap.get(id)?.split('@')[0] || null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectsWithOwner = ((allProjects ?? []) as any[]).map(p => ({
      ...p,
      ownerName:     resolveUser(p.user_id),
      updatedByName: p.updated_by && p.updated_by !== p.user_id ? resolveUser(p.updated_by) : null,
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
  const rawProjects = userDivisions.length > 0
    ? (await adminDb
        .from('projects')
        .select(`*, compliance_reports(id, status, product_family, summary, created_at)`)
        .in('division', userDivisions)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
      ).data ?? []
    : []

  // Resolve editor names for non-admin projects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawProj = rawProjects as Array<{ user_id: string; updated_by: string | null }>
  const nonAdminUserIds = [...new Set([
    ...rawProj.map(p => p.user_id),
    ...rawProj.map(p => p.updated_by).filter(Boolean) as string[],
  ])]
  const [{ data: nonAdminProfiles }, { data: nonAdminAuthUsers }] = await Promise.all([
    adminDb.from('profiles').select('id, full_name').in('id', nonAdminUserIds),
    nonAdminUserIds.length > 0 ? adminDb.auth.admin.listUsers({ perPage: 1000 }) : Promise.resolve({ data: null }),
  ])
  const naNameMap = new Map((nonAdminProfiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]))
  const naEmailMap = new Map((nonAdminAuthUsers?.users ?? []).map(u => [u.id, u.email ?? '']))
  function resolveNonAdminUser(id: string | null): string | null {
    if (!id) return null
    return naNameMap.get(id) || naEmailMap.get(id)?.split('@')[0] || null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects = (rawProjects as any[]).map(p => ({
    ...p,
    updatedByName: p.updated_by && p.updated_by !== p.user_id ? resolveNonAdminUser(p.updated_by) : null,
  }))

  return (
    <DashboardClient
      userName={profile?.full_name ?? user.email?.split('@')[0] ?? 'there'}
      projects={projects}
      userDivisions={userDivisions}
    />
  )
}
