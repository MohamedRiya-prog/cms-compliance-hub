'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Search, Building2, ChevronDown, ChevronRight,
  ExternalLink, X, ChevronLeft,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface ProjectDetail {
  projectId: string
  projectName: string
  reports: number
  totalClauses: number
  comply: number
  notComply: number
  noted: number
  complianceRate: number
  lastActivity: string
}

interface ConsultantStat {
  consultant: string
  projects: number
  reports: number
  totalClauses: number
  comply: number
  notComply: number
  noted: number
  complianceRate: number
  topFailingFamilies: string[]
  lastActivity: string
  projectDetails: ProjectDetail[]
}

interface Props {
  consultants: ConsultantStat[]
}

const PAGE_SIZE = 10

function barColor(rate: number) {
  if (rate >= 80) return 'oklch(0.72 0.19 155)'
  if (rate >= 50) return 'oklch(0.78 0.16 85)'
  return 'oklch(0.68 0.22 25)'
}

function rateColor(rate: number) {
  if (rate >= 80) return 'var(--status-comply)'
  if (rate >= 50) return 'var(--status-noted)'
  return 'var(--status-not-comply)'
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'oklch(0.78 0.16 85 / 0.35)', color: 'inherit', borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function ConsultantsClient({ consultants }: Props) {
  const [consultantSearch, setConsultantSearch] = useState('')
  const [projectSearches, setProjectSearches] = useState<Map<string, string>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pages, setPages] = useState<Map<string, number>>(new Map())

  const cq = consultantSearch.trim().toLowerCase()

  // Filter consultant cards by consultant name only
  const filtered = useMemo(() => {
    if (!cq) return consultants
    return consultants.filter(c => c.consultant.toLowerCase().includes(cq))
  }, [cq, consultants])

  function toggle(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function getProjectSearch(name: string) {
    return projectSearches.get(name) ?? ''
  }

  function setProjectSearch(name: string, value: string) {
    setProjectSearches(prev => new Map(prev).set(name, value))
    setPage(name, 0) // reset to page 1 on new search
  }

  function getPage(name: string) {
    return pages.get(name) ?? 0
  }

  function setPage(name: string, page: number) {
    setPages(prev => new Map(prev).set(name, page))
  }

  const isExpanded = (name: string) => expanded.has(name)

  // Summary stats
  const totalConsultants = consultants.length
  const avgRate = consultants.length > 0
    ? Math.round(consultants.reduce((a, c) => a + c.complianceRate, 0) / consultants.length)
    : 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Summary row */}
      <div className="flex items-center gap-6 mb-6">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Consultants</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalConsultants}</p>
        </div>
        <div className="w-px h-8" style={{ background: 'var(--border-default)' }} />
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Avg Compliance</p>
          <p className="text-2xl font-bold" style={{ color: rateColor(avgRate) }}>{avgRate}%</p>
        </div>
        <div className="w-px h-8" style={{ background: 'var(--border-default)' }} />
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sorted by</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Compliance rate ↓</p>
        </div>
      </div>

      {/* Consultant search */}
      <div className="relative mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          value={consultantSearch}
          onChange={e => { setConsultantSearch(e.target.value); setExpanded(new Set()); setPages(new Map()) }}
          placeholder="Search consultant…"
          className="w-full pl-8 pr-8 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
        {consultantSearch && (
          <button onClick={() => setConsultantSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {cq && (
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {filtered.length === 0 ? 'No results' : `${filtered.length} consultant${filtered.length !== 1 ? 's' : ''} matched`}
        </p>
      )}

      {/* Consultant cards */}
      {consultants.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No consultant data yet. Add consultants to your projects to see scores here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Search size={28} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No results for{cq ? ` "${consultantSearch}"` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, rank) => {
            const open = isExpanded(c.consultant)
            const pq = getProjectSearch(c.consultant).trim().toLowerCase()
            const visibleProjects = pq
              ? c.projectDetails.filter(p => p.projectName.toLowerCase().includes(pq))
              : c.projectDetails
            const page = getPage(c.consultant)
            const totalPages = Math.ceil(visibleProjects.length / PAGE_SIZE)
            const pageProjects = visibleProjects.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

            return (
              <motion.div
                key={c.consultant}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: rank * 0.03 }}
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {/* ── Consultant header ── */}
                <button
                  className="w-full text-left"
                  onClick={() => toggle(c.consultant)}
                >
                  <div
                    className="flex items-center gap-4 px-5 py-4 transition-colors"
                    style={{ background: open ? 'oklch(0.65 0.18 270 / 0.05)' : 'var(--surface-1)' }}
                  >
                    {/* Rank */}
                    <span
                      className="text-xs font-bold w-6 text-center shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {consultants.indexOf(c as ConsultantStat) + 1}
                    </span>

                    {/* Icon + name */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <Building2
                        size={15}
                        className="shrink-0"
                        style={{ color: c.consultant === 'No Consultant' ? 'var(--text-muted)' : 'var(--brand-primary)' }}
                      />
                      <div className="min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: c.consultant === 'No Consultant' ? 'var(--text-muted)' : 'var(--text-primary)' }}
                        >
                          {highlight(c.consultant, cq)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {c.projects} project{c.projects !== 1 ? 's' : ''} · {c.reports} report{c.reports !== 1 ? 's' : ''} · {c.totalClauses.toLocaleString()} clauses
                        </p>
                      </div>
                    </div>

                    {/* Compliance bar */}
                    <div className="flex items-center gap-3 shrink-0" style={{ minWidth: 200 }}>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${c.complianceRate}%`, background: barColor(c.complianceRate) }}
                        />
                      </div>
                      <span
                        className="text-sm font-bold w-10 text-right shrink-0"
                        style={{ color: rateColor(c.complianceRate) }}
                      >
                        {c.complianceRate}%
                      </span>
                    </div>

                    {/* Failing families */}
                    <div className="hidden md:flex gap-1 shrink-0 ml-1">
                      {c.topFailingFamilies.length === 0 ? (
                        <span className="text-xs font-medium" style={{ color: 'var(--status-comply)' }}>No gaps</span>
                      ) : c.topFailingFamilies.map(fam => (
                        <span
                          key={fam}
                          className="px-1.5 py-0.5 rounded font-mono"
                          style={{
                            background: 'oklch(0.68 0.22 25 / 0.10)',
                            color: 'var(--status-not-comply)',
                            border: '1px solid oklch(0.68 0.22 25 / 0.20)',
                            fontSize: 10,
                          }}
                        >
                          {fam}
                        </span>
                      ))}
                    </div>

                    {/* Chevron */}
                    <div className="shrink-0 ml-1" style={{ color: 'var(--text-muted)' }}>
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </div>
                  </div>
                </button>

                {/* ── Project list (expanded) ── */}
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        className="border-t"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-0)' }}
                      >
                        {/* Per-consultant project search */}
                        <div className="relative px-5 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <Search size={12} className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                          <input
                            value={getProjectSearch(c.consultant)}
                            onChange={e => setProjectSearch(c.consultant, e.target.value)}
                            placeholder="Search projects…"
                            className="w-full pl-7 pr-7 py-1.5 rounded-lg text-xs outline-none"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                            onClick={e => e.stopPropagation()}
                          />
                          {getProjectSearch(c.consultant) && (
                            <button
                              onClick={e => { e.stopPropagation(); setProjectSearch(c.consultant, '') }}
                              className="absolute right-8 top-1/2 -translate-y-1/2"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* Column headers */}
                        <div
                          className="grid text-xs font-medium px-5 py-2 border-b"
                          style={{
                            gridTemplateColumns: '1fr 72px 80px 180px 100px',
                            color: 'var(--text-muted)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <span>Project</span>
                          <span className="text-center">Reports</span>
                          <span className="text-center">Clauses</span>
                          <span className="pl-2">Compliance</span>
                          <span className="text-right">Last Activity</span>
                        </div>

                        {/* Empty state for project search */}
                        {visibleProjects.length === 0 && (
                          <div className="py-8 text-center">
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No projects match &ldquo;{getProjectSearch(c.consultant)}&rdquo;</p>
                          </div>
                        )}

                        {/* Project rows */}
                        {pageProjects.map(p => (
                          <Link key={p.projectId} href={`/projects/${p.projectId}`} className="block">
                            <div
                              className="grid items-center px-5 py-3 border-b transition-colors cursor-pointer"
                              style={{
                                gridTemplateColumns: '1fr 72px 80px 180px 100px',
                                borderColor: 'var(--border-subtle)',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {/* Name */}
                              <div className="flex items-center gap-2 min-w-0">
                                <ExternalLink size={11} className="shrink-0" style={{ color: 'var(--brand-primary)' }} />
                                <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {highlight(p.projectName, pq)}
                                </span>
                              </div>

                              {/* Reports */}
                              <span className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                                {p.reports}
                              </span>

                              {/* Clauses */}
                              <span className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                                {p.totalClauses.toLocaleString()}
                              </span>

                              {/* Rate bar */}
                              <div className="flex items-center gap-2 pl-2">
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${p.complianceRate}%`, background: barColor(p.complianceRate) }}
                                  />
                                </div>
                                <span className="text-xs font-bold shrink-0 w-8 text-right" style={{ color: rateColor(p.complianceRate) }}>
                                  {p.complianceRate}%
                                </span>
                              </div>

                              {/* Last activity */}
                              <span className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                                {formatRelativeTime(p.lastActivity)}
                              </span>
                            </div>
                          </Link>
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div
                            className="flex items-center justify-between px-5 py-2.5"
                            style={{ borderTop: '1px solid var(--border-subtle)' }}
                          >
                            <button
                              onClick={e => { e.stopPropagation(); setPage(c.consultant, page - 1) }}
                              disabled={page === 0}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 transition-opacity"
                              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                            >
                              <ChevronLeft size={12} /> Prev
                            </button>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, visibleProjects.length)} of {visibleProjects.length} projects
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); setPage(c.consultant, page + 1) }}
                              disabled={page >= totalPages - 1}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 transition-opacity"
                              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                            >
                              Next <ChevronRight size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
