import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { UsersClient } from './users-client'

export default async function AdminUsersPage() {
  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) notFound()

  const { user } = ctx
  const adminDb = createAdminClient()

  const [{ data: authData }, { data: profiles }, { data: divisionRows }] = await Promise.all([
    adminDb.auth.admin.listUsers({ perPage: 1000 }),
    adminDb.from('profiles').select('id, full_name, role, divisions, functional_role'),
    adminDb.from('divisions').select('name').order('name'),
  ])

  type ProfileRow = { id: string; full_name: string | null; role: string | null; divisions: string[] | null; functional_role: string | null }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]))

  const users = (authData?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? '',
    fullName: profileMap.get(u.id)?.full_name ?? null,
    role: profileMap.get(u.id)?.role ?? 'coordinator',
    divisions: profileMap.get(u.id)?.divisions ?? [],
    functionalRole: profileMap.get(u.id)?.functional_role ?? null,
    createdAt: u.created_at,
    lastSignIn: u.last_sign_in_at ?? null,
  }))

  const availableDivisions = (divisionRows ?? []).map((d: { name: string }) => d.name)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Page header */}
      <div
        className="shrink-0 border-b px-6 pt-5 pb-4"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}
      >
        <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Users
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Manage user roles and access levels
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <UsersClient users={users} currentUserId={user.id} availableDivisions={availableDivisions} />
      </div>
    </div>
  )
}
