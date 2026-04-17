import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildChatSystemPrompt } from '@/lib/prompt-builder'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { message, referencedRowId } = await req.json()

  // Load report with rows
  const { data: report } = await supabase
    .from('compliance_reports')
    .select(`
      *,
      projects!inner(user_id),
      compliance_rows(clause, requirement, product_response, status, remark, id, sort_order)
    `)
    .eq('id', reportId)
    .single()

  const typedReport = report as unknown as {
    id: string; product_family: string; spec_text: string | null;
    projects: { user_id: string };
    compliance_rows: Array<{ id: string; sort_order: number; clause: string; requirement: string; product_response: string; status: string; remark: string }>;
  }

  if (!typedReport || typedReport.projects?.user_id !== user.id) {
    return new Response('Not found', { status: 404 })
  }

  const rows = [...(typedReport.compliance_rows ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const systemPrompt = await buildChatSystemPrompt(typedReport.product_family)

  // Fetch chat history
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })
    .limit(20)

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
  await supabase.from('chat_messages').insert({
    report_id: reportId,
    role: 'user',
    content: message,
    referenced_row_id: referencedRowId ?? null,
  })

  // Stream response
  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: referencedRow ? 512 : 2048,
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
        await supabase.from('chat_messages').insert({
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
