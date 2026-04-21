import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns the authenticated user + their role.
 * `db` is the admin Supabase client (bypasses RLS) when isAdmin=true,
 * otherwise the regular user-scoped client.
 * Returns null if not authenticated.
 */
export async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, divisions')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'coordinator') as 'admin' | 'coordinator' | 'engineer' | 'management'
  const isAdmin = role === 'admin'
  const isManagement = role === 'management'
  const divisions: string[] = (profile as { divisions?: string[] | null } | null)?.divisions ?? []

  return {
    user,
    role,
    isAdmin,
    isManagement,
    divisions,
    // Management gets admin-level read access (sees all data) but write routes block them separately
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: (isAdmin || isManagement ? createAdminClient() : supabase) as ReturnType<typeof createAdminClient>,
    supabase,
  }
}
