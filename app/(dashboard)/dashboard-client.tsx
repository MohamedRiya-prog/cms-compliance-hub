'use client'

import { motion, type Variants } from 'framer-motion'
import Link from 'next/link'
import { Plus, FileText, CheckCircle, Clock, FolderOpen } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface Report {
  id: string
  status: string
  product_family: string
  summary: { total: number; comply: number; notComply: number; noted: number } | null
  created_at: string
}

interface Project {
  id: string
  name: string
  client: string | null
  location: string | null
  updated_at: string
  compliance_reports: Report[]
}

interface Props {
  userName: string
  projects: Project[]
}

const container: Variants = {
  animate: { transition: { staggerChildren: 0.06 } },
}
const item: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function projectStats(projects: Project[]) {
  const totalReports = projects.reduce((a, p) => a + p.compliance_reports.length, 0)
  const complyTotal = projects.reduce((a, p) =>
    a + p.compliance_reports.reduce((b, r) => b + (r.summary?.comply ?? 0), 0), 0)
  const allTotal = projects.reduce((a, p) =>
    a + p.compliance_reports.reduce((b, r) => b + (r.summary?.total ?? 0), 0), 0)
  const rate = allTotal > 0 ? Math.round((complyTotal / allTotal) * 100) : 0
  const pending = projects.reduce((a, p) =>
    a + p.compliance_reports.filter(r => r.status === 'review').length, 0)
  return { totalReports, rate, pending }
}

export function DashboardClient({ userName, projects }: Props) {
  const { totalReports, rate, pending } = projectStats(projects)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {getGreeting()}, {userName}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {projects.length} active project{projects.length !== 1 ? 's' : ''}
        </p>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
      >
        {[
          { label: 'Active Projects', value: projects.length, icon: FolderOpen, color: 'var(--brand-primary)' },
          { label: 'Compliance Rate', value: `${rate}%`, icon: CheckCircle, color: 'var(--status-comply)' },
          { label: 'Total Reports', value: totalReports, icon: FileText, color: 'var(--brand-secondary)' },
          { label: 'Pending Review', value: pending, icon: Clock, color: pending > 0 ? 'var(--status-noted)' : 'var(--text-muted)' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              variants={item}
              className="rounded-xl p-4 border"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                <Icon size={14} style={{ color: stat.color }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Projects Grid */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Projects
        </h2>
        <Link href="/projects/new">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)' }}
          >
            <Plus size={12} />
            New Project
          </motion.button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 rounded-xl border"
          style={{ borderColor: 'var(--border-subtle)', borderStyle: 'dashed' }}
        >
          <FolderOpen size={40} className="mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-base font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No projects yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Create your first project to get started</p>
          <Link href="/projects/new">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)' }}
            >
              <Plus size={14} /> Create Project
            </motion.button>
          </Link>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {projects.map(project => {
            const reports = project.compliance_reports ?? []
            const total = reports.reduce((a, r) => a + (r.summary?.total ?? 0), 0)
            const comply = reports.reduce((a, r) => a + (r.summary?.comply ?? 0), 0)
            const rate = total > 0 ? Math.round((comply / total) * 100) : null

            return (
              <motion.div key={project.id} variants={item}>
                <Link href={`/projects/${project.id}`}>
                  <motion.div
                    whileHover={{ y: -2, boxShadow: '0 8px 32px oklch(0 0 0 / 0.4)' }}
                    className="rounded-xl p-5 border cursor-pointer transition-all"
                    style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {project.name}
                        </h3>
                        {project.client && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                            {project.client}
                          </p>
                        )}
                      </div>
                      {rate !== null && (
                        <span
                          className="shrink-0 ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: rate >= 80 ? 'oklch(0.72 0.19 155 / 0.15)' : rate >= 50 ? 'oklch(0.78 0.16 85 / 0.15)' : 'oklch(0.68 0.22 25 / 0.15)',
                            color: rate >= 80 ? 'var(--status-comply)' : rate >= 50 ? 'var(--status-noted)' : 'var(--status-not-comply)',
                          }}
                        >
                          {rate}%
                        </span>
                      )}
                    </div>

                    {project.location && (
                      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                        {project.location}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {reports.length} report{reports.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatRelativeTime(project.updated_at)}
                      </span>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
