import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/prompt-builder'
import { parseClaudeResponse, computeSummary } from '@/lib/compliance-validator'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Re-runs generation in-place: deletes existing rows and inserts fresh ones.
// Does NOT create a new report record — the report ID stays the same.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Optional instructions from the user (e.g. "use triple-V blades instead of airfoil")
  let instructions: string | undefined
  try {
    const body = await req.json()
    instructions = typeof body?.instructions === 'string' && body.instructions.trim()
      ? body.instructions.trim()
      : undefined
  } catch { /* no body is fine */ }

  const { data: report } = await supabase
    .from('compliance_reports')
    .select('id, spec_text, product_family, projects!inner(user_id)')
    .eq('id', reportId)
    .single()

  const typed = report as unknown as {
    id: string; spec_text: string | null; product_family: string
    projects: { user_id: string }
  }

  if (!typed || typed.projects?.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!typed.spec_text) {
    return NextResponse.json({ error: 'No spec text stored for this report' }, { status: 400 })
  }

  const systemPrompt = await buildSystemPrompt(typed.product_family)

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Generate a compliance table for the following specification section:\n\n${typed.spec_text}${instructions ? `\n\nADDITIONAL INSTRUCTION: ${instructions}` : ''}` }],
  })

  const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
  const rows = parseClaudeResponse(responseText)
  const summary = computeSummary(rows)

  // Replace all existing rows
  await supabase.from('compliance_rows').delete().eq('report_id', reportId)

  if (rows.length > 0) {
    const { error } = await supabase.from('compliance_rows').insert(
      rows.map((row, i) => ({
        report_id: reportId,
        sort_order: i,
        clause: row.clause,
        requirement: row.requirement,
        product_response: row.productResponse ?? '',
        status: row.status,
        remark: row.remark ?? '',
        confidence: row.confidence ?? 'high',
        original_response: row,
      }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from('compliance_reports')
    .update({ summary, status: 'review', updated_at: new Date().toISOString() })
    .eq('id', reportId)

  // Return fresh rows so the client can replace its state
  const { data: newRows } = await supabase
    .from('compliance_rows')
    .select('id, sort_order, clause, requirement, product_response, status, remark, confidence, is_edited')
    .eq('report_id', reportId)
    .order('sort_order')

  return NextResponse.json({ rows: newRows ?? [], summary, rowCount: rows.length })
}
