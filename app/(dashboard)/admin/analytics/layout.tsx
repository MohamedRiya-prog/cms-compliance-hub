import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalyticsTabs } from './analytics-tabs'

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return notFound()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AnalyticsTabs />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
