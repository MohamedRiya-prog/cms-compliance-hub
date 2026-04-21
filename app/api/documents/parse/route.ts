import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseDocument, detectSections, buildDetectionPattern, SectionPattern } from '@/lib/document-parser'

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

  // Load custom products that have detection keywords defined
  const extraPatterns: SectionPattern[] = []
  try {
    const admin = createAdminClient()
    const { data: customProducts } = await admin
      .from('product_data')
      .select('family, label, detection_keywords')
      .not('label', 'is', null)
      .not('detection_keywords', 'is', null)
      .neq('detection_keywords', '')
      .order('family')
    for (const row of customProducts ?? []) {
      if (row.detection_keywords && row.label) {
        extraPatterns.push({
          pattern: buildDetectionPattern(row.detection_keywords),
          family: row.family,
          label: row.label,
        })
      }
    }
  } catch { /* non-critical — built-in patterns still work */ }

  const sections = detectSections(extractedText, extraPatterns)
  return NextResponse.json({ text: extractedText.slice(0, 50000), sections })
}
