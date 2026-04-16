'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Building2, Search, ChevronLeft, ChevronRight,
  X, Check, Clock, Upload, Download, AlertCircle,
} from 'lucide-react'

type CompanyType = 'contractor' | 'main_contractor' | 'consultant'

interface Company {
  id: string
  name: string
  types: CompanyType[]
  city?: string | null
  country?: string | null
}

interface CompanyRequest {
  id: string
  name: string
  types: CompanyType[]
  city?: string | null
  country?: string | null
  created_at: string
  profiles?: { full_name: string } | null
}

interface PageResult {
  data: Company[]
  total: number
  page: number
  pages: number
}

interface ImportRow {
  name: string
  city: string
  country: string
  types: CompanyType[]
  error?: string
}

const TYPE_LABELS: Record<CompanyType, string> = {
  contractor:      'Contractor',
  main_contractor: 'Main Contractor',
  consultant:      'Consultant',
}

const TYPE_COLORS: Record<CompanyType, { bg: string; color: string }> = {
  contractor:      { bg: 'oklch(0.65 0.18 270 / 0.12)', color: 'var(--brand-primary)' },
  main_contractor: { bg: 'oklch(0.72 0.19 155 / 0.12)', color: 'oklch(0.55 0.18 155)' },
  consultant:      { bg: 'oklch(0.75 0.18 55 / 0.15)',  color: 'oklch(0.55 0.18 55)'  },
}

const ALL_TYPES: CompanyType[] = ['contractor', 'main_contractor', 'consultant']
const VALID_TYPES = new Set(ALL_TYPES)

// Simple CSV parser that handles quoted fields
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cols: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur.trim())
    rows.push(cols)
  }
  return rows
}

function parseTypes(raw: string): CompanyType[] {
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase().replace(/ /g, '_'))
    .filter(s => VALID_TYPES.has(s as CompanyType)) as CompanyType[]
}

const CSV_TEMPLATE = `name,city,country,types\nArabtec Construction LLC,Dubai,UAE,contractor\nRamboll Group,Abu Dhabi,UAE,consultant\nAECOM,Dubai,UAE,"consultant,main_contractor"\n`

export function CompaniesClient() {
  const [tab, setTab] = useState<'companies' | 'requests'>('companies')

  // Companies list
  const [result, setResult]         = useState<PageResult>({ data: [], total: 0, page: 1, pages: 0 })
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState<CompanyType | ''>('')
  const [page, setPage]             = useState(1)

  // Add form
  const [adding, setAdding]         = useState(false)
  const [newName, setNewName]       = useState('')
  const [newCity, setNewCity]       = useState('')
  const [newCountry, setNewCountry] = useState('')
  const [newTypes, setNewTypes]     = useState<CompanyType[]>([])
  const [saving, setSaving]         = useState(false)
  const [addError, setAddError]     = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Inline type editing
  const [editingTypesId, setEditingTypesId] = useState<string | null>(null)

  // Import modal
  const [importOpen, setImportOpen]     = useState(false)
  const [importRows, setImportRows]     = useState<ImportRow[]>([])
  const [importing, setImporting]       = useState(false)
  const [importDone, setImportDone]     = useState<{ imported: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Requests
  const [requests, setRequests]       = useState<CompanyRequest[]>([])
  const [reqLoading, setReqLoading]   = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPage = useCallback(async (p: number, q: string, t: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (q) params.set('search', q)
    if (t) params.set('type', t)
    const res  = await fetch(`/api/companies?${params}`)
    const data = await res.json()
    setResult(data?.data ? data : { data: [], total: 0, page: p, pages: 0 })
    setLoading(false)
  }, [])

  const fetchRequests = useCallback(async () => {
    setReqLoading(true)
    const data = await fetch('/api/companies/request').then(r => r.json())
    setRequests(Array.isArray(data) ? data : [])
    setReqLoading(false)
  }, [])

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => { setPage(1); fetchPage(1, search, typeFilter) }, 300)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [search, typeFilter, fetchPage])

  useEffect(() => { fetchPage(page, search, typeFilter) }, [page]) // eslint-disable-line
  useEffect(() => { if (tab === 'requests') fetchRequests() }, [tab, fetchRequests])

  // ── Inline type toggle ──
  async function toggleInlineType(company: Company, t: CompanyType) {
    const current = company.types ?? []
    const next    = current.includes(t) ? current.filter(x => x !== t) : [...current, t]
    const res = await fetch(`/api/companies/${company.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ types: next }),
    })
    if (res.ok) {
      setResult(prev => ({
        ...prev,
        data: prev.data.map(c => c.id === company.id ? { ...c, types: next } : c),
      }))
    }
  }

  // ── CSV import ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (rows.length < 2) return

      const header = rows[0].map(h => h.toLowerCase().trim())
      const nameIdx    = header.indexOf('name')
      const cityIdx    = header.indexOf('city')
      const countryIdx = header.indexOf('country')
      const typesIdx   = header.indexOf('types')

      if (nameIdx === -1) { alert('CSV must have a "name" column'); return }

      const parsed: ImportRow[] = rows.slice(1).map(row => {
        const name    = row[nameIdx]?.trim() ?? ''
        const city    = cityIdx    >= 0 ? row[cityIdx]?.trim()    ?? '' : ''
        const country = countryIdx >= 0 ? row[countryIdx]?.trim() ?? '' : ''
        const rawTypes = typesIdx  >= 0 ? row[typesIdx]?.trim()   ?? '' : ''
        const types   = parseTypes(rawTypes)
        const error   = !name ? 'Missing name' : undefined
        return { name, city, country, types, error }
      }).filter(r => r.name)

      setImportRows(parsed)
      setImportDone(null)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function runImport() {
    const valid = importRows.filter(r => !r.error)
    if (!valid.length) return
    setImporting(true)
    const res  = await fetch('/api/companies/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: valid }),
    })
    const data = await res.json()
    setImportDone({ imported: data.imported ?? 0, errors: data.errors ?? [] })
    setImporting(false)
    setPage(1); fetchPage(1, search, typeFilter)
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'companies-template.csv'
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Add form helpers ──
  function toggleType(t: CompanyType) {
    setNewTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }
  function resetAddForm() {
    setNewName(''); setNewCity(''); setNewCountry(''); setNewTypes([]); setAddError('')
  }
  async function handleAdd() {
    const name = newName.trim()
    if (!name || newTypes.length === 0) return
    setSaving(true); setAddError('')
    const res  = await fetch('/api/companies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, types: newTypes, city: newCity || undefined, country: newCountry || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error ?? 'Failed to add') }
    else { resetAddForm(); setAdding(false); setPage(1); fetchPage(1, search, typeFilter) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' })
    if (res.ok) fetchPage(page, search, typeFilter)
    setDeletingId(null)
  }

  async function handleApprove(id: string) {
    setApprovingId(id)
    const res = await fetch(`/api/companies/request/${id}`, { method: 'POST' })
    if (res.ok) { setRequests(prev => prev.filter(r => r.id !== id)); fetchPage(1, search, typeFilter) }
    setApprovingId(null)
  }

  async function handleReject(id: string) {
    setRejectingId(id)
    const res = await fetch(`/api/companies/request/${id}`, { method: 'DELETE' })
    if (res.ok) setRequests(prev => prev.filter(r => r.id !== id))
    setRejectingId(null)
  }

  const { data: companies, total, pages } = result
  const pendingCount = requests.length
  const validImportRows = importRows.filter(r => !r.error)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}>
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Companies</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {tab === 'companies'
              ? total > 0 ? `${total.toLocaleString()} companies` : 'Contractors, main contractors and consultants'
              : 'Pending requests from team members'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: 'var(--surface-2)' }}>
            <button onClick={() => setTab('companies')}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: tab === 'companies' ? 'var(--surface-3)' : 'transparent', color: tab === 'companies' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              Companies
            </button>
            <button onClick={() => setTab('requests')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: tab === 'requests' ? 'var(--surface-3)' : 'transparent', color: tab === 'requests' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              Requests
              {pendingCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
                  style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)', fontSize: 10 }}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {tab === 'companies' && (
            <>
              <button onClick={() => { setImportOpen(true); setImportRows([]); setImportDone(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all hover:opacity-80"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
                <Upload size={13} /> Import CSV
              </button>
              <button onClick={() => { setAdding(true); setAddError('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)' }}>
                <Plus size={14} /> Add Company
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── COMPANIES TAB ── */}
      {tab === 'companies' && (
        <>
          {/* Search + filters */}
          <div className="flex items-center gap-3 px-6 py-3 shrink-0 border-b"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search companies…"
                className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}><X size={12} /></button>}
            </div>
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--surface-2)' }}>
              <button onClick={() => setTypeFilter('')}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={{ background: typeFilter === '' ? 'var(--surface-3)' : 'transparent', color: typeFilter === '' ? 'var(--text-primary)' : 'var(--text-muted)' }}>All</button>
              {ALL_TYPES.map(t => (
                <button key={t} onClick={() => setTypeFilter(prev => prev === t ? '' : t)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                  style={{ background: typeFilter === t ? TYPE_COLORS[t].bg : 'transparent', color: typeFilter === t ? TYPE_COLORS[t].color : 'var(--text-muted)' }}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Add form */}
          <AnimatePresence>
            {adding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden', borderBottom: '1px solid var(--border-default)', background: 'var(--surface-2)' }}>
                <div className="px-6 py-4 space-y-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>New Company</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: newName, set: setNewName, placeholder: 'Company name *', autoFocus: true },
                      { value: newCity, set: setNewCity, placeholder: 'City' },
                      { value: newCountry, set: setNewCountry, placeholder: 'Country' },
                    ].map(({ value, set, placeholder, autoFocus }) => (
                      <input key={placeholder} autoFocus={autoFocus} type="text" value={value}
                        onChange={e => set(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); resetAddForm() } }}
                        placeholder={placeholder}
                        className="px-3 py-2 text-sm rounded-lg outline-none"
                        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Role(s):</span>
                      {ALL_TYPES.map(t => {
                        const active = newTypes.includes(t)
                        return (
                          <button key={t} type="button" onClick={() => toggleType(t)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                            style={{ background: active ? TYPE_COLORS[t].bg : 'var(--surface-3)', color: active ? TYPE_COLORS[t].color : 'var(--text-muted)', border: `1px solid ${active ? TYPE_COLORS[t].color + '44' : 'transparent'}` }}>
                            {TYPE_LABELS[t]}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {addError && <span className="text-xs" style={{ color: 'var(--status-not-comply)' }}>{addError}</span>}
                      <button onClick={() => { setAdding(false); resetAddForm() }} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>Cancel</button>
                      <button onClick={handleAdd} disabled={saving || !newName.trim() || newTypes.length === 0}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)', opacity: saving || !newName.trim() || newTypes.length === 0 ? 0.5 : 1 }}>
                        {saving ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-1)' }}>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-6 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Company</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Location</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Roles <span className="font-normal opacity-60">(click to toggle)</span>
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-6 py-3"><div className="h-4 w-48 rounded animate-pulse" style={{ background: 'var(--surface-3)' }} /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 rounded animate-pulse" style={{ background: 'var(--surface-3)' }} /></td>
                      <td className="px-4 py-3"><div className="h-5 w-40 rounded animate-pulse" style={{ background: 'var(--surface-3)' }} /></td>
                      <td />
                    </tr>
                  ))
                ) : companies.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-20 text-center">
                    <Building2 size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {search || typeFilter ? 'No companies match your filters' : 'No companies yet'}
                    </p>
                  </td></tr>
                ) : (
                  companies.map(company => {
                    const isEditingTypes = editingTypesId === company.id
                    return (
                      <tr key={company.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        className="transition-colors hover:bg-[var(--surface-2)]">
                        <td className="px-6 py-3">
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{company.name}</span>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                          {[company.city, company.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap items-center">
                            {ALL_TYPES.map(t => {
                              const active = (company.types ?? []).includes(t)
                              return (
                                <button key={t} type="button"
                                  onClick={() => toggleInlineType(company, t)}
                                  title={active ? `Remove ${TYPE_LABELS[t]}` : `Add ${TYPE_LABELS[t]}`}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:opacity-80"
                                  style={{
                                    background: active ? TYPE_COLORS[t].bg : 'var(--surface-3)',
                                    color: active ? TYPE_COLORS[t].color : 'var(--text-muted)',
                                    border: `1px solid ${active ? TYPE_COLORS[t].color + '33' : 'transparent'}`,
                                    opacity: active ? 1 : 0.5,
                                  }}>
                                  {TYPE_LABELS[t]}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                        <td className="pr-4 py-3 text-right">
                          <button onClick={() => handleDelete(company.id)} disabled={deletingId === company.id}
                            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                            style={{ color: 'var(--status-not-comply)', opacity: deletingId === company.id ? 0.3 : 1 }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 shrink-0 border-t text-sm"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Page {page} of {pages} · {total.toLocaleString()} total</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                  className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                      style={{ background: p === page ? 'var(--brand-primary)' : 'transparent', color: p === page ? 'oklch(0.98 0.002 260)' : 'var(--text-secondary)' }}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setPage(p => p + 1)} disabled={page >= pages}
                  className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <div className="flex-1 overflow-y-auto">
          {reqLoading ? (
            <div className="space-y-2 p-6">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-24">
              <Clock size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No pending requests</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>New requests from team members will appear here</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-1)' }}>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-6 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Company</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Location</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Roles</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Requested by</th>
                  <th className="w-36" />
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="hover:bg-[var(--surface-2)]">
                    <td className="px-6 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{req.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{[req.city, req.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {(req.types ?? []).map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].color }}>
                            {TYPE_LABELS[t]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{req.profiles?.full_name ?? '—'}</td>
                    <td className="pr-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => handleReject(req.id)} disabled={rejectingId === req.id || approvingId === req.id}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium hover:opacity-70"
                          style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)' }}>Reject</button>
                        <button onClick={() => handleApprove(req.id)} disabled={approvingId === req.id || rejectingId === req.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium hover:opacity-70"
                          style={{ background: 'oklch(0.72 0.19 155 / 0.15)', color: 'oklch(0.55 0.18 155)' }}>
                          <Check size={11} /> Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── IMPORT MODAL ── */}
      <AnimatePresence>
        {importOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'oklch(0 0 0 / 0.5)' }}
            onClick={() => setImportOpen(false)}>
            <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-default)' }}>
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Import Companies from CSV</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Existing companies are updated, new ones are added
                  </p>
                </div>
                <button onClick={() => setImportOpen(false)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Format help */}
                <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Expected columns</p>
                  <code className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                    name, city, country, types
                  </code>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>types</strong> — comma-separated:{' '}
                    <code>contractor</code>, <code>main_contractor</code>, <code>consultant</code>
                    <br />
                    Multiple types: <code>&quot;contractor,consultant&quot;</code> (wrap in quotes)
                  </p>
                  <button onClick={downloadTemplate}
                    className="flex items-center gap-1.5 text-xs mt-1 hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--brand-primary)' }}>
                    <Download size={12} /> Download template
                  </button>
                </div>

                {/* File picker */}
                {!importDone && (
                  <div>
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full py-8 rounded-xl border-2 border-dashed text-sm transition-all hover:opacity-80 flex flex-col items-center gap-2"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                      <Upload size={20} />
                      Click to select CSV file
                    </button>
                  </div>
                )}

                {/* Preview */}
                {importRows.length > 0 && !importDone && (
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Preview — {validImportRows.length} valid rows
                      {importRows.length - validImportRows.length > 0 && (
                        <span style={{ color: 'var(--status-not-comply)' }}>
                          {' '}· {importRows.length - validImportRows.length} errors
                        </span>
                      )}
                    </p>
                    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                      <table className="w-full text-xs border-collapse">
                        <thead style={{ background: 'var(--surface-1)' }}>
                          <tr>
                            {['Name','City','Country','Types'].map(h => (
                              <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 8).map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)', background: row.error ? 'oklch(0.68 0.22 25 / 0.06)' : 'transparent' }}>
                              <td className="px-3 py-2" style={{ color: row.error ? 'var(--status-not-comply)' : 'var(--text-primary)' }}>
                                {row.error ? <span className="flex items-center gap-1"><AlertCircle size={11} />{row.error}</span> : row.name}
                              </td>
                              <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{row.city || '—'}</td>
                              <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{row.country || '—'}</td>
                              <td className="px-3 py-2">
                                <div className="flex gap-1 flex-wrap">
                                  {row.types.length > 0
                                    ? row.types.map(t => (
                                        <span key={t} className="px-1.5 py-0.5 rounded-full text-xs"
                                          style={{ background: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].color }}>
                                          {TYPE_LABELS[t]}
                                        </span>
                                      ))
                                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  }
                                </div>
                              </td>
                            </tr>
                          ))}
                          {importRows.length > 8 && (
                            <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                              <td colSpan={4} className="px-3 py-2 text-center" style={{ color: 'var(--text-muted)' }}>
                                …and {importRows.length - 8} more rows
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Success */}
                {importDone && (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ background: 'oklch(0.72 0.19 155 / 0.15)' }}>
                      <Check size={20} style={{ color: 'oklch(0.55 0.18 155)' }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {importDone.imported} companies imported
                    </p>
                    {importDone.errors.length > 0 && (
                      <p className="text-xs mt-1" style={{ color: 'var(--status-not-comply)' }}>
                        {importDone.errors.length} rows had errors
                      </p>
                    )}
                    <button onClick={() => { setImportRows([]); setImportDone(null) }}
                      className="mt-4 text-xs hover:opacity-70" style={{ color: 'var(--brand-primary)' }}>
                      Import another file
                    </button>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              {!importDone && (
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--border-default)' }}>
                  <button onClick={() => setImportOpen(false)} className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>Cancel</button>
                  <button onClick={runImport} disabled={importing || validImportRows.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)', opacity: importing || validImportRows.length === 0 ? 0.5 : 1 }}>
                    <Upload size={13} />
                    {importing ? 'Importing…' : `Import ${validImportRows.length} companies`}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
