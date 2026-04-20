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
  const role = (profile?.role ?? 'coordinator') as 'admin' | 'coordinator' | 'engineer'
  const isAdmin = role === 'admin'

  // Engineers can see all reports (including pending_verification from other projects)
  const db = (isAdmin || role === 'engineer') ? createAdminClient() : supabase

  const { data: report } = await db
    .from('compliance_reports')
    .select(`*, projects!inner(id, name, client, location, project_number, contractor, main_contractor, consultant, user_id), compliance_rows(*)`)
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
    revision: number
    created_at: string
    updated_at: string
    verified_at: string | null
    verified_by: string | null
    generation_metadata: Record<string, unknown> | null
    verification_note: string | null
    projects: {
      id: string
      name: string
      client: string | null
      location: string | null
      project_number: string | null
      contractor: string | null
      main_contractor: string | null
      consultant: string | null
      user_id: string
    }
    compliance_rows: Array<{
      id: string; sort_order: number; clause: string; requirement: string;
      product_response: string; status: string; remark: string;
      confidence: string; is_edited: boolean
    }>
  }

  // Look up verifier name
  let verifiedByName: string | null = null
  if (typedReport?.verified_by) {
    const adminDb2 = createAdminClient()
    const { data: verifierProfile } = await adminDb2
      .from('profiles')
      .select('full_name')
      .eq('id', typedReport.verified_by)
      .single()
    verifiedByName = verifierProfile?.full_name ?? null
  }

  // Admins and engineers see all reports; others only see their own project's reports
  if (!typedReport || (!isAdmin && role !== 'engineer' && typedReport.projects?.user_id !== user.id)) {
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
        revision: typedReport.revision ?? 0,
        createdAt: typedReport.created_at,
        updatedAt: typedReport.updated_at,
        generationMetadata: typedReport.generation_metadata,
        verificationNote: typedReport.verification_note ?? null,
        verifiedBy: verifiedByName,
        verifiedAt: typedReport.verified_at ?? null,
      }}
      project={{
        id: typedReport.projects.id,
        name: typedReport.projects.name,
        client: typedReport.projects.client,
        location: typedReport.projects.location,
        projectNumber: typedReport.projects.project_number,
        contractor: typedReport.projects.contractor,
        mainContractor: typedReport.projects.main_contractor,
        consultant: typedReport.projects.consultant,
      }}
      initialRows={rows}
      isAdmin={isAdmin}
      userRole={role}
    />
  )
}
