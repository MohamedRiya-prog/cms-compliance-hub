import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Join through projects to verify ownership
  const { data: doc } = await supabase
    .from('spec_documents')
    .select('id, file_name, file_type, extracted_text, projects!inner(user_id)')
    .eq('id', docId)
    .single()

  const typed = doc as unknown as {
    id: string; file_name: string; file_type: string
    extracted_text: string | null
    projects: { user_id: string }
  }

  if (!typed || typed.projects?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: typed.id,
    fileName: typed.file_name,
    fileType: typed.file_type,
    text: typed.extracted_text ?? '',
  })
}
