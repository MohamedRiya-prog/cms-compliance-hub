import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, isAdmin, isManagement, divisions } = ctx

  // Use admin client to fetch document with project division info
  const adminDb = createAdminClient()
  const { data: doc } = await adminDb
    .from('spec_documents')
    .select('id, file_name, file_type, storage_path, extracted_text, projects!inner(user_id, division)')
    .eq('id', docId)
    .single()

  const typed = doc as unknown as {
    id: string; file_name: string; file_type: string
    storage_path: string | null
    extracted_text: string | null
    projects: { user_id: string; division: string | null }
  }

  const hasDivAccess = divisions.length > 0 && typed?.projects?.division != null && divisions.includes(typed.projects.division)
  if (!typed || (!isAdmin && !isManagement && typed.projects?.user_id !== user.id && !hasDivAccess)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // For PDFs, generate a short-lived signed URL so the browser can render the original file
  let signedUrl: string | null = null
  if (typed.file_type === 'pdf' && typed.storage_path) {
    const { data } = await adminDb.storage
      .from('spec-documents')
      .createSignedUrl(typed.storage_path, 3600) // 1 hour
    signedUrl = data?.signedUrl ?? null
  }

  return NextResponse.json({
    id: typed.id,
    fileName: typed.file_name,
    fileType: typed.file_type,
    text: typed.extracted_text ?? '',
    signedUrl,
  })
}
