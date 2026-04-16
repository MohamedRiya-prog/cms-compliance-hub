import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt } from '@/lib/prompt-builder'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function formatTableAsText(rows: Array<{ clause: string; requirement: string; product_response: string; status: string; remark: string }>): string {
  return rows.map(r =>
    `[${r.clause}] ${r.status.toUpperCase()} — ${r.requirement}\nProduct Response: ${r.product_response}\nRemark: ${r.remark}`
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
  const systemPrompt = await buildSystemPrompt(typedReport.product_family)

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
        ? `Regarding clause ${referencedRow.clause} (currently ${referencedRow.status}): ${message}`
        : message,
    },
  ]

  const fullSystemPrompt = systemPrompt + `

If the user asks you to update a row, respond with your explanation first, then append the update in this exact format at the very end:
[UPDATE_ROW]{"rowId":"<id>","clause":"<clause>","productResponse":"<value>","status":"<status>","remark":"<remark>"}[/UPDATE_ROW]

Only include [UPDATE_ROW] if the user explicitly asks to change a row.`

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
    max_tokens: 2048,
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
