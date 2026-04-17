import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ReportViewClient } from './report-view-client'

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>
}) {
  const { reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  const db = isAdmin ? createAdminClient() : supabase

  const { data: report } = await db
    .from('compliance_reports')
    .select(`*, projects!inner(id, name, user_id), compliance_rows(*)`)
    .eq('id', reportId)
    .single()

  const typedReport = report as unknown as {
    id: string
    title: string
    product_family: string
    product_model: string | null
    status: string
    summary: Record<string, number> | null
    spec_text: string | null
    spec_document_id: string | null
    created_at: string
    updated_at: string
    generation_metadata: Record<string, unknown> | null
    projects: { id: string; name: string; user_id: string }
    compliance_rows: Array<{
      id: string; sort_order: number; clause: string; requirement: string;
      product_response: string; status: string; remark: string;
      confidence: string; is_edited: boolean
    }>
  }

  if (!typedReport || (!isAdmin && typedReport.projects?.user_id !== user.id)) {
    notFound()
  }

  const rows = [...(typedReport.compliance_rows ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <ReportViewClient
      report={{
        id: typedReport.id,
        title: typedReport.title,
        productFamily: typedReport.product_family,
        status: typedReport.status,
        summary: typedReport.summary,
        specText: typedReport.spec_text,
        specDocumentId: typedReport.spec_document_id ?? null,
        createdAt: typedReport.created_at,
        updatedAt: typedReport.updated_at,
        generationMetadata: typedReport.generation_metadata,
      }}
      project={{ id: typedReport.projects.id, name: typedReport.projects.name }}
      initialRows={rows}
      isAdmin={isAdmin}
    />
  )
}
