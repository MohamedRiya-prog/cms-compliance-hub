import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RulesClient } from './rules-client'

export default async function RulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  return <RulesClient />
}
