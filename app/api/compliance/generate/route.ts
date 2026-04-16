import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, getComplianceRules, getProductData, getComplianceExamples, computePromptVersion } from '@/lib/prompt-builder'
import { parseClaudeResponse, computeSummary } from '@/lib/compliance-validator'
import { computeTextHash } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  specText: z.string().min(1),
  productFamily: z.string(),
  specDocumentId: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  title: z.string().default('Compliance Report'),
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { specText, productFamily, specDocumentId, projectId, title } = parsed.data

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Deduplication: check if same spec hash exists
  const contentHash = computeTextHash(specText)
  const { data: existing } = await supabase
    .from('compliance_reports')
    .select('id')
    .eq('project_id', projectId)
    .filter('generation_metadata->content_hash', 'eq', contentHash)
    .single()

  if (existing) {
    return NextResponse.json({ id: existing.id, cached: true })
  }

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(productFamily)
  const [rules, products, examples] = await Promise.all([
    getComplianceRules(),
    getProductData(productFamily),
    getComplianceExamples(),
  ])
  const promptVersion = computePromptVersion(rules, products, examples)

  // Create report in "generating" state
  const { data: report, error: reportError } = await supabase
    .from('compliance_reports')
    .insert({
      project_id: projectId,
      spec_document_id: specDocumentId ?? null,
      title,
      product_family: productFamily,
      status: 'generating',
      spec_text: specText.slice(0, 50000),
      prompt_version: JSON.stringify(promptVersion),
      generation_metadata: { content_hash: contentHash, model: 'claude-opus-4-6', started_at: new Date().toISOString() },
    })
    .select()
    .single()

  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 })

  try {
    const startTime = Date.now()

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate a compliance table for the following specification section:\n\n${specText}`,
        },
      ],
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
    const rows = parseClaudeResponse(responseText)
    const summary = computeSummary(rows)
    const duration = Date.now() - startTime

    // Insert rows
    if (rows.length > 0) {
      const { error: rowsError } = await supabase.from('compliance_rows').insert(
        rows.map((row, i) => ({
          report_id: report.id,
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
      if (rowsError) throw new Error(rowsError.message)
    }

    // Update report to "review"
    await supabase
      .from('compliance_reports')
      .update({
        status: 'review',
        summary,
        generation_metadata: {
          content_hash: contentHash,
          model: response.model,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          duration_ms: duration,
          started_at: new Date(startTime).toISOString(),
        },
      })
      .eq('id', report.id)

    return NextResponse.json({ id: report.id, summary, rowCount: rows.length })

  } catch (err: unknown) {
    // Mark report as failed
    await supabase
      .from('compliance_reports')
      .update({ status: 'error' } as Record<string, unknown>)
      .eq('id', report.id)

    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
