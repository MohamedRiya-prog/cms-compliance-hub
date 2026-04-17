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
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  return {
    user,
    isAdmin,
    // Use this for all data queries — bypasses RLS only when confirmed admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: (isAdmin ? createAdminClient() : supabase) as ReturnType<typeof createAdminClient>,
    supabase,
  }
}
