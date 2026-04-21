import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/prompt-builder'
import { parseClaudeResponse, computeSummary } from '@/lib/compliance-validator'
import { getAuthContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.isManagement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user, isAdmin, divisions, db } = ctx

  let instructions: string | undefined
  let createRevision = false
  try {
    const body = await req.json()
    instructions = typeof body?.instructions === 'string' && body.instructions.trim()
      ? body.instructions.trim()
      : undefined
    createRevision = body?.createRevision === true
  } catch { /* no body is fine */ }

  const { data: report } = await db
    .from('compliance_reports')
    .select('id, spec_text, product_family, title, spec_document_id, project_id, revision, status, projects!inner(user_id, division)')
    .eq('id', reportId)
    .single()

  const typed = report as unknown as {
    id: string
    spec_text: string | null
    product_family: string
    title: string
    spec_document_id: string | null
    project_id: string
    revision: number
    status: string
    projects: { user_id: string; division: string | null }
  }

  const hasDivAccess = divisions.length > 0 && typed?.projects?.division != null && divisions.includes(typed.projects.division)
  if (!typed || (!isAdmin && typed.projects?.user_id !== user.id && !hasDivAccess)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!typed.spec_text) {
    return NextResponse.json({ error: 'No spec text stored for this report' }, { status: 400 })
  }

  // Locked reports always create a new revision
  if (typed.status === 'verified' || typed.status === 'approved') {
    createRevision = true
  }

  // If creating a new revision, insert a new report record first
  let targetReportId = reportId
  let newReportId: string | undefined

  if (createRevision) {
    const nextRevision = (typed.revision ?? 0) + 1
    const { data: newReport, error: newReportError } = await db
      .from('compliance_reports')
      .insert({
        project_id: typed.project_id,
        spec_document_id: typed.spec_document_id,
        title: typed.title,
        product_family: typed.product_family,
        status: 'generating',
        spec_text: typed.spec_text,
        revision: nextRevision,
      })
      .select('id')
      .single()

    if (newReportError || !newReport) {
      return NextResponse.json({ error: 'Failed to create new revision' }, { status: 500 })
    }

    targetReportId = (newReport as { id: string }).id
    newReportId = targetReportId
  }

  const systemPrompt = await buildSystemPrompt(typed.product_family)

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Generate a compliance table for the following specification section:\n\n${typed.spec_text}${instructions ? `\n\nADDITIONAL INSTRUCTION: ${instructions}` : ''}`,
    }],
  })

  const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
  const rows = parseClaudeResponse(responseText)
  const summary = computeSummary(rows)

  // Replace rows for target report (in-place or newly created)
  await db.from('compliance_rows').delete().eq('report_id', targetReportId)

  if (rows.length > 0) {
    const { error } = await db.from('compliance_rows').insert(
      rows.map((row, i) => ({
        report_id: targetReportId,
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

  await db
    .from('compliance_reports')
    .update({ summary, status: 'review', updated_at: new Date().toISOString() })
    .eq('id', targetReportId)

  // When a new revision was created, supersede previous revisions still in review
  if (createRevision && newReportId) {
    const adminDb = createAdminClient()
    await adminDb
      .from('compliance_reports')
      .update({ status: 'superseded' })
      .eq('project_id', typed.project_id)
      .eq('product_family', typed.product_family)
      .eq('status', 'review')
      .neq('id', newReportId)
  }

  const { data: newRows } = await db
    .from('compliance_rows')
    .select('id, sort_order, clause, requirement, product_response, status, remark, confidence, is_edited')
    .eq('report_id', targetReportId)
    .order('sort_order')

  return NextResponse.json({
    rows: newRows ?? [],
    summary,
    rowCount: rows.length,
    ...(newReportId ? { newReportId } : {}),
  })
}
