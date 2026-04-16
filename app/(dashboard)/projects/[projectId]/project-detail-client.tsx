'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, type Variants } from 'framer-motion'
import { ArrowLeft, Upload, FileText, Trash2, ExternalLink, Download, Loader } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface Report {
  id: string
  title: string
  product_family: string
  product_model: string | null
  status: string
  summary: { total: number; comply: number; notComply: number; noted: number; notPartOfProposal: number } | null
  created_at: string
  updated_at: string
  compliance_rows: { id: string }[]
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

const container: Variants = { animate: { transition: { staggerChildren: 0.06 } } }
const item: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

const statusColorMap: Record<string, string> = {
  generating: 'var(--text-muted)',
  review: 'var(--status-noted)',
  approved: 'var(--status-comply)',
  exported: 'var(--brand-primary)',
}

export function ProjectDetailClient({ project }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }

  async function handleExportAll() {
    setExporting(true)
    try {
      const res = await fetch(`/api/compliance/export?projectId=${project.id}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = project.name.replace(/[^a-z0-9]/gi, '_')
      a.download = `${safeName}_Compliance.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — user will see nothing downloaded
    } finally {
      setExporting(false)
    }
  }

  const hasReports = project.compliance_reports.length > 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <Link href="/">
        <button className="flex items-center gap-2 text-sm mb-6 hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Dashboard
        </button>
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6"
      >
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {project.client && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{project.client}</span>}
            {project.location && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>· {project.location}</span>}
            {project.project_number && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>· #{project.project_number}</span>}
          </div>
          {project.description && (
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{project.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {/* Export All — visible on all screen sizes when reports exist */}
          {hasReports && (
            <motion.button
              onClick={handleExportAll}
              disabled={exporting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                opacity: exporting ? 0.6 : 1,
              }}
            >
              {exporting
                ? <Loader size={12} className="animate-spin" />
                : <Download size={12} />
              }
              Export All
            </motion.button>
          )}
          {/* Upload Spec hidden on mobile */}
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
      </motion.div>

      {/* Reports */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Compliance Reports ({project.compliance_reports.length})
        </h2>

        {project.compliance_reports.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 rounded-xl border"
            style={{ borderColor: 'var(--border-subtle)', borderStyle: 'dashed' }}
          >
            <FileText size={32} className="mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No reports yet</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Upload a spec document to generate compliance tables</p>
            <Link href={`/projects/${project.id}/upload`}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)' }}>
                <Upload size={12} /> Upload Spec
              </button>
            </Link>
          </div>
        ) : (
          <motion.div variants={container} initial="initial" animate="animate" className="space-y-2">
            {project.compliance_reports.map(report => {
              const total = report.summary?.total ?? report.compliance_rows.length
              const comply = report.summary?.comply ?? 0
              const rate = total > 0 ? Math.round((comply / total) * 100) : 0

              return (
                <motion.div key={report.id} variants={item}>
                  <Link href={`/projects/${project.id}/reports/${report.id}`}>
                    <motion.div
                      whileHover={{ x: 2 }}
                      className="flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer"
                      style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{report.title}</h3>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full border capitalize"
                            style={{ color: statusColorMap[report.status] ?? 'var(--text-muted)', background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
                          >
                            {report.status}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {report.product_family} · {total} clauses · {formatRelativeTime(report.updated_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {total > 0 && (
                          <span
                            className="text-sm font-bold"
                            style={{ color: rate >= 80 ? 'var(--status-comply)' : rate >= 50 ? 'var(--status-noted)' : 'var(--status-not-comply)' }}
                          >
                            {rate}%
                          </span>
                        )}
                        <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      {/* Spec Documents */}
      {project.spec_documents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            Uploaded Documents
          </h2>
          <div className="space-y-2">
            {project.spec_documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
              >
                <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{doc.file_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {doc.file_type.toUpperCase()} · {formatRelativeTime(doc.uploaded_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
