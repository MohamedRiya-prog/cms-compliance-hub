import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      compliance_reports(id, status, product_family, summary, created_at)
    `)
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
