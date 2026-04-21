'use client'

import { useState } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import Link from 'next/link'
import { Plus, FileText, CheckCircle, Clock, FolderOpen, Search, ChevronDown } from 'lucide-react'
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
  project_number: string | null
  client: string | null
  location: string | null
  contractor: string | null
  main_contractor: string | null
  consultant: string | null
  division: string | null
  updated_at: string
  compliance_reports: Report[]
  ownerName?: string | null
  updatedByName?: string | null
}

interface Props {
  userName: string
  projects: Project[]
  isAdmin?: boolean
  userDivisions?: string[]
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

/** Per project: keep only the best-compliance revision per product_family */
function dedupReports(reports: Report[]): Report[] {
  const best = new Map<string, Report>()
  for (const r of reports) {
    const existing = best.get(r.product_family)
    if (!existing) {
      best.set(r.product_family, r)
    } else {
      const existRate = existing.summary?.total ? (existing.summary.comply ?? 0) / existing.summary.total : 0
      const currRate  = r.summary?.total        ? (r.summary.comply ?? 0)          / r.summary.total        : 0
      if (currRate > existRate) best.set(r.product_family, r)
    }
  }
  return Array.from(best.values())
}

function projectStats(projects: Project[]) {
  let complyTotal = 0, allTotal = 0, totalReports = 0
  for (const p of projects) {
    const deduped = dedupReports(p.compliance_reports)
    totalReports += deduped.length
    for (const r of deduped) {
      complyTotal += r.summary?.comply ?? 0
      allTotal    += r.summary?.total  ?? 0
    }
  }
  const rate = allTotal > 0 ? Math.round((complyTotal / allTotal) * 100) : 0
  const pending = projects.reduce((a, p) =>
    a + dedupReports(p.compliance_reports).filter(r => r.status === 'review').length, 0)
  return { totalReports, rate, pending }
}

function ProjectCard({ project, isAdmin }: { project: Project; isAdmin?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const reports = project.compliance_reports ?? []
  const deduped = dedupReports(reports)
  const total  = deduped.reduce((a, r) => a + (r.summary?.total ?? 0), 0)
  const comply = deduped.reduce((a, r) => a + (r.summary?.comply ?? 0), 0)
  const rate   = total > 0 ? Math.round((comply / total) * 100) : null

  const details: { label: string; value: string }[] = []
  if (project.client)           details.push({ label: 'Client',           value: project.client })
  if (project.location)         details.push({ label: 'Location',         value: project.location })
  if (project.main_contractor)  details.push({ label: 'Main Contractor',  value: project.main_contractor })
  else if (project.contractor)  details.push({ label: 'Contractor',       value: project.contractor })
  if (project.consultant)       details.push({ label: 'Consultant',       value: project.consultant })
  if (project.division)         details.push({ label: 'Division',         value: project.division })
  if (isAdmin && project.ownerName) details.push({ label: 'Owner', value: project.ownerName })
  if (project.updatedByName)       details.push({ label: 'Last edited by', value: project.updatedByName })

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 32px oklch(0 0 0 / 0.4)' }}
      className="rounded-xl border overflow-hidden transition-all"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Header — always visible, click navigates */}
      <Link href={`/projects/${project.id}`} className="block p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {project.project_number && (
                <span className="text-[10px] font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
                  {project.project_number}
                </span>
              )}
              <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {project.name}
              </h3>
            </div>
            {/* Preview line when collapsed */}
            {!expanded && project.client && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                {project.client}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {rate !== null && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: rate >= 80 ? 'oklch(0.72 0.19 155 / 0.15)' : rate >= 50 ? 'oklch(0.78 0.16 85 / 0.15)' : 'oklch(0.68 0.22 25 / 0.15)',
                  color:      rate >= 80 ? 'var(--status-comply)'          : rate >= 50 ? 'var(--status-noted)'        : 'var(--status-not-comply)',
                }}
              >
                {rate}%
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Expandable details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1.5">
              {details.length > 0 ? details.map(d => (
                <div key={d.label} className="flex gap-2 text-xs">
                  <span className="shrink-0 font-medium w-28" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                  <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{d.value}</span>
                </div>
              )) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No additional details</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {reports.length} report{reports.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {project.updatedByName
              ? <><span style={{ color: 'var(--text-secondary)' }}>{project.updatedByName}</span> · </>
              : null}
            {formatRelativeTime(project.updated_at)}
          </span>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs rounded px-1.5 py-0.5 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={13} />
          </motion.span>
        </button>
      </div>
    </motion.div>
  )
}

export function DashboardClient({ userName, projects, isAdmin, userDivisions }: Props) {
  const [search, setSearch] = useState('')
  const { totalReports, rate, pending } = projectStats(projects)

  const sq = search.trim().toLowerCase()
  const filteredProjects = sq
    ? projects.filter(p =>
        p.name.toLowerCase().includes(sq) ||
        (p.project_number ?? '').toLowerCase().includes(sq) ||
        (p.client ?? '').toLowerCase().includes(sq) ||
        (p.location ?? '').toLowerCase().includes(sq) ||
        (p.contractor ?? '').toLowerCase().includes(sq) ||
        (p.main_contractor ?? '').toLowerCase().includes(sq) ||
        (p.consultant ?? '').toLowerCase().includes(sq) ||
        (p.division ?? '').toLowerCase().includes(sq) ||
        (p.ownerName ?? '').toLowerCase().includes(sq)
      )
    : projects

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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {isAdmin ? 'All Projects' : 'Projects'}
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

      {/* Search */}
      <div className="relative mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, reference, client, location…"
          className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
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
      ) : filteredProjects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 rounded-xl border"
          style={{ borderColor: 'var(--border-subtle)', borderStyle: 'dashed' }}
        >
          <Search size={32} className="mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No projects match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch('')} className="text-xs mt-2 hover:opacity-70" style={{ color: 'var(--brand-primary)' }}>
            Clear search
          </button>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredProjects.map(project => (
            <motion.div key={project.id} variants={item}>
              <ProjectCard project={project} isAdmin={isAdmin} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
