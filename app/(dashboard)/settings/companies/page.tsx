import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompaniesClient } from './companies-client'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  return <CompaniesClient />
}
