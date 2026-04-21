import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { parseDocument, detectSections } from '@/lib/document-parser'
import { computeTextHash } from '@/lib/utils'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
const EXT_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'text',
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.isManagement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user, isAdmin, divisions } = ctx

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null

  if (!file || !projectId) {
    return NextResponse.json({ error: 'file and projectId are required' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  // Verify user owns the project or is in the same division
  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('id, user_id, division')
    .eq('id', projectId)
    .single()

  const pj = project as { id: string; user_id: string; division: string | null } | null
  const hasDivAccess = divisions.length > 0 && pj?.division != null && divisions.includes(pj.division)
  if (!pj || (!isAdmin && pj.user_id !== user.id && !hasDivAccess)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const fileType = EXT_MAP[file.type] ?? 'text'
  const storagePath = `${user.id}/${projectId}/${Date.now()}-${file.name}`

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('spec-documents')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Parse text
  let extractedText = ''
  try {
    extractedText = await parseDocument(buffer, fileType)
  } catch (err) {
    console.error('Parse error:', err)
  }

  const contentHash = computeTextHash(extractedText)
  const extractedSections = detectSections(extractedText)

  // Save to database
  const { data: doc, error: dbError } = await admin
    .from('spec_documents')
    .insert({
      project_id: projectId,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      storage_path: storagePath,
      extracted_text: extractedText.slice(0, 100000),
      extracted_sections: extractedSections,
      content_hash: contentHash,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({
    document: doc,
    sections: extractedSections,
  }, { status: 201 })
}
