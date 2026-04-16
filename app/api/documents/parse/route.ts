import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseDocument, detectSections } from '@/lib/document-parser'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const text = formData.get('text') as string | null

  let extractedText = ''
  let fileType = 'text'

  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer())
    fileType = file.name.split('.').pop()?.toLowerCase() ?? 'text'
    extractedText = await parseDocument(buffer, fileType)
  } else if (text) {
    extractedText = text
  } else {
    return NextResponse.json({ error: 'file or text required' }, { status: 400 })
  }

  const sections = detectSections(extractedText)
  return NextResponse.json({ text: extractedText.slice(0, 50000), sections })
}
