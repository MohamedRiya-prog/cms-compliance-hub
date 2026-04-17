'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ArrowLeft, Upload, FileText, Trash2, ExternalLink, Download, Loader, X } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface ComplianceRow {
  id: string
  sort_order: number
  clause: string
  requirement: string
  product_response: string
  status: string
  remark: string
}

interface Report {
  id: string
  title: string
  product_family: string
  product_model: string | null
  status: string
  summary: { total: number; comply: number; notComply: number; noted: number; notPartOfProposal: number } | null
  created_at: string
  updated_at: string
  spec_document_id: string | null
  compliance_rows: ComplianceRow[]
}

interface SpecDoc {
  id: string
  file_name: string
  file_type: string
  file_size: number | null
  uploaded_at: string
}

interface Project {
  id: string
  name: string
  client: string | null
  location: string | null
  project_number: string | null
  description: string | null
  status: string
  created_at: string
  updated_at: string
  spec_documents: SpecDoc[]
  compliance_reports: Report[]
}

interface Props { project: Project }

const STATUS_BG: Record<string, string> = {
  comply:               'oklch(0.72 0.19 155 / 0.12)',
  not_comply:           'oklch(0.68 0.22 25  / 0.12)',
  noted:                'oklch(0.78 0.16 85  / 0.12)',
  not_part_of_proposal: 'oklch(0.55 0.02 260 / 0.08)',
  header:               'oklch(0.65 0.18 270 / 0.10)',
}
const STATUS_TEXT: Record<string, string> = {
  comply:               'var(--status-comply)',
  not_comply:           'var(--status-not-comply)',
  noted:                'var(--status-noted)',
  not_part_of_proposal: 'var(--text-muted)',
  header:               'var(--brand-primary)',
}
const STATUS_LABEL: Record<string, string> = {
  comply:               'Comply',
  not_comply:           'Not Comply',
  noted:                'Noted',
  not_part_of_proposal: 'Not Part of Proposal',
  header:               '',
}

const reportStatusColor: Record<string, string> = {
  generating: 'var(--text-muted)',
  review:     'var(--status-noted)',
  approved:   'var(--status-comply)',
  exported:   'var(--brand-primary)',
}

interface DocPreview { id: string; fileName: string; fileType: string; text: string }

export function ProjectDetailClient({ project }: Props) {
  const router = useRouter()
  const [deleting,  setDeleting]  = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)
  const [docPreview,  setDocPreview]  = useState<DocPreview | null>(null)
  const [docLoading,  setDocLoading]  = useState<string | null>(null)

  const hasReports = project.compliance_reports.length > 0

  // Sort reports by created_at so the preview order is consistent
  const sortedReports = [...project.compliance_reports].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Group reports by their source spec document (null = pasted text / no document)
  const docMap = new Map<string, SpecDoc>(project.spec_documents.map(d => [d.id, d]))
  const reportsByDoc = sortedReports.reduce<Map<string | null, Report[]>>((acc, r) => {
    const key = r.spec_document_id ?? null
    if (!acc.has(key)) acc.set(key, [])
    acc.get(key)!.push(r)
    return acc
  }, new Map())
  // Order: documents first (in upload order), then null group
  const groupOrder: Array<string | null> = [
    ...project.spec_documents.map(d => d.id).filter(id => reportsByDoc.has(id)),
    ...(reportsByDoc.has(null) ? [null] : []),
  ]

  async function handleDelete() {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }

  async function handleDeleteReport(reportId: string, reportTitle: string) {
    if (!confirm(`Delete "${reportTitle}"? This cannot be undone.`)) return
    setDeletingReportId(reportId)
    const res = await fetch(`/api/compliance/${reportId}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
    } else {
      alert('Delete failed')
      setDeletingReportId(null)
    }
  }

  async function handleDocClick(docId: string) {
    if (docPreview?.id === docId) { setDocPreview(null); return }
    setDocLoading(docId)
    try {
      const res  = await fetch(`/api/documents/${docId}`)
      const data = await res.json()
      if (res.ok) setDocPreview(data)
    } finally {
      setDocLoading(null)
    }
  }

  async function handleExportAll() {
    setExporting(true)
    try {
      const res = await fetch(`/api/compliance/export?projectId=${project.id}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}_Compliance.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Top bar */}
      <div
        className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 md:px-6 py-3 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-xs hover:opacity-80 shrink-0" style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={13} /> Dashboard
            </button>
          </Link>
          <span style={{ color: 'var(--border-default)' }}>·</span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{project.name}</h1>
            <div className="flex items-center gap-1.5 flex-wrap">
              {project.client       && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.client}</span>}
              {project.location     && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {project.location}</span>}
              {project.project_number && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· #{project.project_number}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasReports && (
            <motion.button
              onClick={handleExportAll}
              disabled={exporting}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
              Export All
            </motion.button>
          )}
          <Link href={`/projects/${project.id}/upload`} className="hidden md:block">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)' }}
            >
              <Upload size={12} /> Upload Spec
            </motion.button>
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Delete project"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Panels */}
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">

        {/* Left — report list + spec docs */}
        <Panel defaultSize={28} minSize={18} maxSize={44}>
          <div className="h-full overflow-y-auto py-4 px-3 space-y-5" style={{ background: 'var(--surface-1)' }}>

            {/* Reports grouped by source document */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-3" style={{ color: 'var(--text-muted)' }}>
                Reports ({project.compliance_reports.length})
              </p>

              {project.compliance_reports.length === 0 ? (
                <div className="px-2">
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>No reports yet</p>
                  <Link href={`/projects/${project.id}/upload`}>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium w-full justify-center" style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)' }}>
                      <Upload size={11} /> Upload Spec
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupOrder.map(docId => {
                    const reports = reportsByDoc.get(docId) ?? []
                    const doc     = docId ? docMap.get(docId) : null
                    const isActive  = docPreview?.id === docId
                    const isLoading = docLoading === docId

                    return (
                      <div key={docId ?? '__ungrouped__'}>
                        {/* Document header — clickable to preview */}
                        <button
                          onClick={() => docId ? handleDocClick(docId) : undefined}
                          disabled={!docId}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 text-left transition-all"
                          style={{
                            background: isActive ? 'oklch(0.65 0.18 270 / 0.10)' : 'transparent',
                            border: isActive ? '1px solid oklch(0.65 0.18 270 / 0.25)' : '1px solid transparent',
                            cursor: docId ? 'pointer' : 'default',
                          }}
                        >
                          {docId
                            ? isLoading
                              ? <Loader size={12} className="animate-spin shrink-0" style={{ color: 'var(--brand-primary)' }} />
                              : <FileText size={12} className="shrink-0" style={{ color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)' }} />
                            : <FileText size={12} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                          }
                          <span className="text-xs font-medium truncate flex-1" style={{ color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>
                            {doc ? doc.file_name : 'Pasted text'}
                          </span>
                          {doc && (
                            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                              {doc.file_type.toUpperCase()}
                            </span>
                          )}
                        </button>

                        {/* Reports under this document */}
                        <div className="space-y-0.5 pl-3 border-l ml-3.5" style={{ borderColor: 'var(--border-subtle)' }}>
                          {reports.map(report => {
                            const total  = report.summary?.total ?? report.compliance_rows.length
                            const comply = report.summary?.comply ?? 0
                            const rate   = total > 0 ? Math.round((comply / total) * 100) : null

                            return (
                              <div key={report.id} className="group relative flex items-center rounded-lg"
                                style={{ background: 'transparent' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <Link href={`/projects/${project.id}/reports/${report.id}`} className="flex-1 min-w-0">
                                  <motion.div whileHover={{ x: 2 }} className="flex items-center gap-2 px-2 py-2 cursor-pointer">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                          {report.product_family}
                                        </p>
                                        <span className="text-xs capitalize shrink-0" style={{ color: reportStatusColor[report.status] ?? 'var(--text-muted)' }}>
                                          · {report.status}
                                        </span>
                                      </div>
                                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                        {total} clauses · {formatRelativeTime(report.updated_at)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {rate !== null && (
                                        <span className="text-xs font-bold" style={{ color: rate >= 80 ? 'var(--status-comply)' : rate >= 50 ? 'var(--status-noted)' : 'var(--status-not-comply)' }}>
                                          {rate}%
                                        </span>
                                      )}
                                      <ExternalLink size={11} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                  </motion.div>
                                </Link>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteReport(report.id, report.product_family) }}
                                  disabled={deletingReportId === report.id}
                                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 mr-1 rounded transition-all hover:bg-[var(--surface-3)]"
                                  style={{ color: 'var(--status-not-comply)' }}
                                  title="Delete report"
                                >
                                  {deletingReportId === report.id ? <Loader size={11} className="animate-spin" /> : <X size={11} />}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {/* Documents with no reports yet */}
                  {project.spec_documents
                    .filter(d => !reportsByDoc.has(d.id))
                    .map(doc => {
                      const isActive  = docPreview?.id === doc.id
                      const isLoading = docLoading === doc.id
                      return (
                        <div key={doc.id}>
                          <button
                            onClick={() => handleDocClick(doc.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all"
                            style={{
                              background: isActive ? 'oklch(0.65 0.18 270 / 0.10)' : 'transparent',
                              border: isActive ? '1px solid oklch(0.65 0.18 270 / 0.25)' : '1px solid transparent',
                            }}
                          >
                            {isLoading
                              ? <Loader size={12} className="animate-spin shrink-0" style={{ color: 'var(--brand-primary)' }} />
                              : <FileText size={12} className="shrink-0" style={{ color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)' }} />
                            }
                            <span className="text-xs font-medium truncate flex-1" style={{ color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>
                              {doc.file_name}
                            </span>
                            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{doc.file_type.toUpperCase()}</span>
                          </button>
                          <p className="text-xs pl-7 mt-0.5" style={{ color: 'var(--text-muted)' }}>No reports yet</p>
                        </div>
                      )
                    })
                  }
                </div>
              )}
            </div>
          </div>
        </Panel>

        {/* Resize handle */}
        <PanelResizeHandle className="group relative w-1 flex items-center justify-center cursor-col-resize">
          <div className="w-px h-full transition-colors group-hover:bg-[var(--brand-primary)]" style={{ background: 'var(--border-default)' }} />
          <div className="absolute flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 rounded-full" style={{ background: 'var(--brand-primary)' }} />)}
          </div>
        </PanelResizeHandle>

        {/* Right — export preview OR doc text viewer */}
        <Panel defaultSize={72} minSize={40}>
          <div className="h-full flex flex-col" style={{ background: 'var(--surface-0)' }}>

            {/* Panel header */}
            <div
              className="px-5 py-2.5 shrink-0 border-b flex items-center justify-between gap-3"
              style={{ borderColor: 'var(--border-default)' }}
            >
              {docPreview ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} style={{ color: 'var(--brand-primary)' }} />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{docPreview.fileName}</span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{docPreview.fileType.toUpperCase()}</span>
                  </div>
                  <button
                    onClick={() => setDocPreview(null)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ← Back to Preview
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Export Preview</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {sortedReports.reduce((n, r) => n + r.compliance_rows.length, 0)} total clauses across {sortedReports.length} report{sortedReports.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>

            {docPreview ? (
              /* ── Spec document text viewer ── */
              <div className="flex-1 overflow-auto p-5">
                <pre
                  className="whitespace-pre-wrap text-xs leading-relaxed"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                >
                  {docPreview.text || '(No text extracted from this document)'}
                </pre>
              </div>
            ) : sortedReports.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No reports yet — upload a spec to generate compliance tables</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                {/* Excel-style table */}
                <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '120px' }} />
                    <col />
                  </colgroup>

                  {/* Sticky column headers */}
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {['Clause', 'Requirement', 'Product Response', 'Status', 'Remark'].map(h => (
                        <th
                          key={h}
                          className="px-2.5 py-2 text-left font-semibold border"
                          style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)', fontSize: '11px' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {groupOrder.map(docId => {
                      const reports = reportsByDoc.get(docId) ?? []
                      const doc     = docId ? docMap.get(docId) : null
                      const docLabel = doc ? doc.file_name : 'Pasted text'

                      return (
                        <>
                          {/* Document divider row */}
                          <tr key={`doc-${docId ?? 'ungrouped'}`}>
                            <td
                              colSpan={5}
                              className="px-3 py-1.5 border"
                              style={{
                                background: 'oklch(0.65 0.18 270 / 0.08)',
                                color: 'var(--brand-primary)',
                                borderColor: 'var(--border-default)',
                                borderLeft: '3px solid var(--brand-primary)',
                                fontSize: '10px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <FileText size={10} />
                                {docLabel}
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                                  — {reports.reduce((n, r) => n + r.compliance_rows.length, 0)} clauses across {reports.length} report{reports.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {reports.map(report => {
                            const rows = [...report.compliance_rows].sort((a, b) => a.sort_order - b.sort_order)
                            const total  = report.summary?.total ?? rows.length
                            const comply = report.summary?.comply ?? 0
                            const rate   = total > 0 ? Math.round((comply / total) * 100) : null

                            return (
                              <>
                                {/* Product section header */}
                                <tr key={`hdr-${report.id}`}>
                                  <td
                                    colSpan={5}
                                    className="px-3 py-2 border font-semibold"
                                    style={{
                                      background: 'var(--surface-2)',
                                      color: 'var(--text-primary)',
                                      borderColor: 'var(--border-default)',
                                      borderLeft: '3px solid oklch(0.65 0.18 270 / 0.4)',
                                      fontSize: '11px',
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{report.title}</span>
                                      <div className="flex items-center gap-3 font-normal text-xs" style={{ color: 'var(--text-muted)' }}>
                                        <span>{total} clauses</span>
                                        {rate !== null && (
                                          <span style={{ color: rate >= 80 ? 'var(--status-comply)' : rate >= 50 ? 'var(--status-noted)' : 'var(--status-not-comply)' }}>
                                            {rate}% comply
                                          </span>
                                        )}
                                        <Link href={`/projects/${project.id}/reports/${report.id}`} onClick={e => e.stopPropagation()}>
                                          <span className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer" style={{ color: 'var(--brand-primary)' }}>
                                            Open <ExternalLink size={10} />
                                          </span>
                                        </Link>
                                      </div>
                                    </div>
                                  </td>
                                </tr>

                                {rows.length === 0 ? (
                                  <tr key={`empty-${report.id}`}>
                                    <td colSpan={5} className="px-3 py-2 border text-center" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
                                      No rows
                                    </td>
                                  </tr>
                                ) : rows.map(row => {
                                  const bg   = STATUS_BG[row.status]   ?? 'var(--surface-1)'
                                  const text = STATUS_TEXT[row.status] ?? 'var(--text-primary)'
                                  return (
                                    <tr key={row.id} style={{ background: bg }}>
                                      <td className="px-2.5 py-1.5 border align-top" style={{ borderColor: 'var(--border-subtle)', color: text, fontWeight: row.status === 'header' ? 600 : 400 }}>
                                        {row.clause}
                                      </td>
                                      <td className="px-2.5 py-1.5 border align-top whitespace-pre-wrap" style={{ borderColor: 'var(--border-subtle)', color: text }}>
                                        {row.requirement}
                                      </td>
                                      <td className="px-2.5 py-1.5 border align-top whitespace-pre-wrap" style={{ borderColor: 'var(--border-subtle)', color: text }}>
                                        {row.product_response}
                                      </td>
                                      <td className="px-2.5 py-1.5 border align-top" style={{ borderColor: 'var(--border-subtle)', color: text, fontWeight: 500 }}>
                                        {STATUS_LABEL[row.status] ?? row.status}
                                      </td>
                                      <td className="px-2.5 py-1.5 border align-top whitespace-pre-wrap" style={{ borderColor: 'var(--border-subtle)', color: text }}>
                                        {row.remark}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </>
                            )
                          })}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

      </PanelGroup>
    </div>
  )
}
