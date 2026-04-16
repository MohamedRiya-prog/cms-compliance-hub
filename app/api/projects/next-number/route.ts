import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nextNumber = await generateProjectNumber()
  return NextResponse.json({ projectNumber: nextNumber })
}

export async function generateProjectNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const admin = createAdminClient()

  // Count all projects created this year across all users
  const startOfYear = `${year}-01-01T00:00:00.000Z`
  const endOfYear   = `${year}-12-31T23:59:59.999Z`

  const { count } = await admin
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfYear)
    .lte('created_at', endOfYear)

  const seq = String((count ?? 0) + 1).padStart(3, '0')
  return `CMS-${year}-${seq}`
}
