import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { NewProjectClient } from './new-project-client'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, divisions')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const userDivisions: string[] = (profile as { divisions?: string[] | null } | null)?.divisions ?? []

  // Admins can choose from all divisions in the divisions table
  let availableDivisions: string[]
  if (isAdmin) {
    const adminDb = createAdminClient()
    const { data: divisionRows } = await adminDb
      .from('divisions')
      .select('name')
      .order('name')
    availableDivisions = (divisionRows ?? []).map((d: { name: string }) => d.name)
    if (availableDivisions.length === 0) availableDivisions = ['GD & ACC']
  } else {
    availableDivisions = userDivisions
  }

  // Coordinators with no divisions assigned can't create projects
  if (!isAdmin && availableDivisions.length === 0) {
    redirect('/?error=no-division')
  }

  return <NewProjectClient availableDivisions={availableDivisions} />
}
