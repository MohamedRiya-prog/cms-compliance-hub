import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminDb = createAdminClient()
  const [{ data: profile }, { data: teamProfiles }] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
    adminDb.from('profiles').select('id, full_name, role, functional_role'),
  ])

  // Admins only appear in the team presence panel if they have a functional_role set
  // (e.g. an admin who also acts as an engineer). Pure admins are hidden.
  const teamMembers = (teamProfiles ?? [])
    .filter(p => {
      const role = (p.role as string | null) ?? 'coordinator'
      const functional = (p.functional_role as string | null)
      // Management is always hidden (silent role)
      if (role === 'management') return false
      // Pure admins hidden unless they have a functional role
      return role !== 'admin' || !!functional
    })
    .map(p => {
      const role = (p.role as string | null) ?? 'coordinator'
      const functional = (p.functional_role as string | null)
      return {
        id: p.id as string,
        name: ((p.full_name as string | null)?.trim()) || 'Unknown',
        role,
        // Admins with a functional role appear under that role in the panel
        displayRole: role === 'admin' && functional ? functional : role,
      }
    })

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <Sidebar
        userId={user.id}
        userEmail={user.email}
        userName={profile?.full_name}
        userRole={profile?.role}
        teamMembers={teamMembers}
      />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
