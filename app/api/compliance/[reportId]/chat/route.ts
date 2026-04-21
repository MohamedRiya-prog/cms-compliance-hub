import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildChatSystemPrompt } from '@/lib/prompt-builder'
import { getAuthContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const LOCKED_STATUSES = ['verified', 'approved']

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function formatTableAsText(rows: Array<{ id: string; clause: string; requirement: string; product_response: string; status: string; remark: string }>): string {
  return rows.map(r =>
    `ROW_ID:${r.id} | [${r.clause}] ${r.status.toUpperCase()} — ${r.requirement}\nProduct Response: ${r.product_response}\nRemark: ${r.remark}`
  ).join('\n\n')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const ctx = await getAuthContext()
  if (!ctx) return new Response('Unauthorized', { status: 401 })
  if (ctx.isManagement) return new Response('Forbidden', { status: 403 })
  const { user, isAdmin, divisions, db, supabase } = ctx

  const { message, referencedRowId } = await req.json()

  // Load report with rows
  const { data: report } = await db
    .from('compliance_reports')
    .select(`
      *,
      projects!inner(user_id, division),
      compliance_rows(clause, requirement, product_response, status, remark, id, sort_order)
    `)
    .eq('id', reportId)
    .single()

  const typedReport = report as unknown as {
    id: string; product_family: string; spec_text: string | null; status: string;
    revision: number; project_id: string; title: string; spec_document_id: string | null;
    projects: { user_id: string; division: string | null };
    compliance_rows: Array<{ id: string; sort_order: number; clause: string; requirement: string; product_response: string; status: string; remark: string }>;
  }

  const hasDivAccess = divisions.length > 0 && typedReport?.projects?.division != null && divisions.includes(typedReport.projects.division)
  if (!typedReport || (!isAdmin && typedReport.projects?.user_id !== user.id && !hasDivAccess)) {
    return new Response('Not found', { status: 404 })
  }

  // Locked report → auto-fork into a new revision, client will redirect
  if (LOCKED_STATUSES.includes(typedReport.status)) {
    const adminDb = createAdminClient()
    const nextRevision = (typedReport.revision ?? 0) + 1

    const { data: newReport, error: forkErr } = await adminDb
      .from('compliance_reports')
      .insert({
        project_id: typedReport.project_id,
        spec_document_id: typedReport.spec_document_id,
        title: typedReport.title,
        product_family: typedReport.product_family,
        status: 'review',
        spec_text: typedReport.spec_text,
        revision: nextRevision,
      })
      .select('id')
      .single()

    if (forkErr || !newReport) {
      return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 })
    }
    const newReportId = (newReport as { id: string }).id

    // Copy all rows
    const { data: allRows } = await adminDb
      .from('compliance_rows').select('*').eq('report_id', reportId).order('sort_order')
    const now = new Date().toISOString()
    const rowsToInsert = (allRows ?? []).map(({ id: _id, ...r }: Record<string, unknown>) => ({
      ...r, report_id: newReportId, updated_at: now,
    }))
    if (rowsToInsert.length > 0) await adminDb.from('compliance_rows').insert(rowsToInsert)

    return NextResponse.json({ forked: true, newReportId }, { status: 202 })
  }

  const rows = [...(typedReport.compliance_rows ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const systemPrompt = await buildChatSystemPrompt(typedReport.product_family)

  // Enforce message limit — counts USER messages only, across all sessions for this report
  const MAX_USER_MESSAGES = 20
  const { count: userMsgCount } = await db
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('report_id', reportId)
    .eq('role', 'user')

  if ((userMsgCount ?? 0) >= MAX_USER_MESSAGES) {
    return new Response(
      JSON.stringify({ error: 'limit_reached', limit: MAX_USER_MESSAGES }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Fetch chat history from DB (persists across refreshes — limit cannot be bypassed)
  const { data: history } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })
    .limit(MAX_USER_MESSAGES * 2)

  const referencedRow = referencedRowId ? rows.find(r => r.id === referencedRowId) : null

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Here is the compliance table I generated:\n\n${formatTableAsText(rows)}\n\n${typedReport.spec_text ? `Original specification:\n${typedReport.spec_text.slice(0, 4000)}` : ''}`,
    },
    {
      role: 'assistant',
      content: 'I have the compliance table and specification context. I can help you re-verify clauses, explain decisions, or suggest corrections. What would you like to review?',
    },
    ...(history ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    {
      role: 'user',
      content: referencedRow
        ? `Regarding clause ${referencedRow.clause} (ROW_ID:${referencedRow.id}, currently ${referencedRow.status}): ${message}`
        : message,
    },
  ]

  const modeInstruction = referencedRow
    ? `

SINGLE ROW MODE — ABSOLUTE OUTPUT RULE:
Re-evaluate ONLY this row using the product data and compliance rules above.
Your ENTIRE response must be EXACTLY ONE [UPDATE_ROW] block. Zero words before it, zero words after it. No greeting, no explanation, nothing.

Row to re-evaluate:
ROW_ID: ${referencedRow.id}
Clause: ${referencedRow.clause}
Current status: ${referencedRow.status}
Current Product Response: ${referencedRow.product_response}
Current Remark: ${referencedRow.remark}

Emit the corrected block now using this exact format:
[UPDATE_ROW]{"rowId":"${referencedRow.id}","clause":"${referencedRow.clause}","productResponse":"<corrected value>","status":"<comply|not_comply|noted|not_part_of_proposal|header>","remark":"<corrected remark>"}[/UPDATE_ROW]`
    : `

RESPONSE STYLE: Reply in 1-2 sentences maximum. No preamble, no summary of what you did.

IMPORTANT — TABLE STRUCTURE:
- Rows with status HEADER are product/section title rows. The model name (e.g. "EVFD-10") is stored in their "requirement" field. These ARE valid update targets.
- All other rows are compliance data rows (Product Response, Status, Remark).
- Every row has a ROW_ID — NEVER ask the user to provide one. NEVER invent or guess one.

ROW UPDATES — append at the very end of your response:

[UPDATE_ROW]{"rowId":"<exact ROW_ID>","clause":"<clause>","requirement":"<new model name — HEADER rows only>","productResponse":"<updated product response>","status":"<comply|not_comply|noted|not_part_of_proposal|header>","remark":"<updated remark>"}[/UPDATE_ROW]

Rules:
- Use only ROW_IDs from the table. NEVER ask the user for one. NEVER invent one.
- When changing the product model (e.g. EVFD-10D → EVFD-10): emit one [UPDATE_ROW] for the HEADER row (set "requirement" to the new model name) PLUS one [UPDATE_ROW] for every data row that changes as a result.
- For data rows: omit the "requirement" field.
- Emit [UPDATE_ROW] blocks for any row you recommend changing.
- All [UPDATE_ROW] blocks go at the very end. Do NOT reproduce the full table.`

  const fullSystemPrompt = systemPrompt + modeInstruction

  // Save user message
  await db.from('chat_messages').insert({
    report_id: reportId,
    role: 'user',
    content: message,
    referenced_row_id: referencedRowId ?? null,
  })

  // Stream response
  // Token limits: admin = full access, non-admin = 800 for general chat
  const maxTokens = referencedRow ? 512 : (isAdmin ? 2048 : 800)

  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: maxTokens,
    system: fullSystemPrompt,
    messages,
  })

  let fullResponse = ''
  const readable = new ReadableStream({
    async start(controller) {
      stream.on('text', text => {
        fullResponse += text
        controller.enqueue(new TextEncoder().encode(text))
      })
      stream.on('error', err => {
        controller.error(err)
      })
      stream.on('finalMessage', async () => {
        controller.close()
        // Save assistant message
        await db.from('chat_messages').insert({
          report_id: reportId,
          role: 'assistant',
          content: fullResponse,
          referenced_row_id: referencedRowId ?? null,
        })
      })
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
