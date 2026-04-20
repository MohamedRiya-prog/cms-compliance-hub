'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'
import Link from 'next/link'
import { SearchableSelect } from '@/components/ui/searchable-select'

type CompanyType = 'contractor' | 'main_contractor' | 'consultant'

const TYPE_LABELS: Record<CompanyType, string> = {
  contractor:      'Contractor',
  main_contractor: 'Main Contractor',
  consultant:      'Consultant',
}
const ALL_TYPES: CompanyType[] = ['contractor', 'main_contractor', 'consultant']

interface RequestModal { name: string; forType: CompanyType }

async function searchCompanies(query: string, type: string) {
  const params = new URLSearchParams({ search: query, type, limit: '5' })
  const res = await fetch(`/api/companies?${params}`)
  const d = await res.json()
  return Array.isArray(d?.data) ? d.data : []
}

interface Project {
  id: string; name: string; client: string | null; location: string | null;
  project_number: string | null; description: string | null; status: string;
  contractor: string | null; main_contractor: string | null; consultant: string | null;
}

export function ProjectSettingsClient({ project }: { project: Project }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name:           project.name,
    client:         project.client         ?? '',
    location:       project.location       ?? '',
    projectNumber:  project.project_number ?? '',
    contractor:     project.contractor     ?? '',
    mainContractor: project.main_contractor ?? '',
    consultant:     project.consultant     ?? '',
    description:    project.description   ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  // Request modal
  const [requestModal, setRequestModal] = useState<RequestModal | null>(null)
  const [reqTypes,     setReqTypes]     = useState<CompanyType[]>([])
  const [reqCity,      setReqCity]      = useState('')
  const [reqCountry,   setReqCountry]   = useState('')
  const [reqSaving,    setReqSaving]    = useState(false)
  const [reqDone,      setReqDone]      = useState(false)
  const [reqError,     setReqError]     = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function openRequest(name: string, forType: CompanyType) {
    setRequestModal({ name, forType })
    setReqTypes([forType])
    setReqCity('')
    setReqCountry('')
    setReqDone(false)
    setReqError('')
  }

  function closeRequest() {
    setRequestModal(null)
    setReqTypes([])
    setReqDone(false)
    setReqError('')
  }

  function toggleReqType(t: CompanyType) {
    setReqTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function submitRequest() {
    if (!requestModal || reqTypes.length === 0) return
    setReqSaving(true)
    setReqError('')
    const res = await fetch('/api/companies/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:    requestModal.name,
        types:   reqTypes,
        city:    reqCity    || undefined,
        country: reqCountry || undefined,
      }),
    })
    if (!res.ok) {
      const d = await res.json()
      setReqError(d.error ?? 'Failed to submit')
    } else {
      setReqDone(true)
      setTimeout(closeRequest, 1800)
    }
    setReqSaving(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
    background: 'var(--surface-2)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', outline: 'none',
  } as React.CSSProperties

  return (
    <div className="p-6 max-w-3xl">
      <Link href={`/projects/${project.id}`}>
        <button className="flex items-center gap-2 text-sm mb-6 hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Back to Project
        </button>
      </Link>
      <h1 className="text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Project Settings</h1>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Project Name */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Project Name *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required style={inputStyle} />
        </div>

        {/* Client + Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Client</label>
            <input type="text" value={form.client} onChange={e => set('client', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Location</label>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Contractor / Main Contractor / Consultant */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Contractor</label>
            <SearchableSelect
              onSearch={q => searchCompanies(q, 'contractor')}
              onRequestAdd={name => openRequest(name, 'contractor')}
              value={form.contractor}
              onChange={v => set('contractor', v)}
              placeholder="Search contractor…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Main Contractor</label>
            <SearchableSelect
              onSearch={q => searchCompanies(q, 'main_contractor')}
              onRequestAdd={name => openRequest(name, 'main_contractor')}
              value={form.mainContractor}
              onChange={v => set('mainContractor', v)}
              placeholder="Search main contractor…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Consultant</label>
            <SearchableSelect
              onSearch={q => searchCompanies(q, 'consultant')}
              onRequestAdd={name => openRequest(name, 'consultant')}
              value={form.consultant}
              onChange={v => set('consultant', v)}
              placeholder="Search consultant…"
            />
          </div>
        </div>

        {/* Project Number — read-only */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Project Number</label>
          <div className="px-3.5 py-2.5 rounded-lg text-sm font-mono" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--brand-primary)' }}>
            {form.projectNumber || '—'}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="resize-none" style={inputStyle} />
        </div>

        <motion.button
          type="submit"
          disabled={saving}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: saved ? 'var(--status-comply)' : 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)' }}
        >
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
        </motion.button>
      </form>

      {/* Request modal — same as new project form */}
      <AnimatePresence>
        {requestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'oklch(0 0 0 / 0.5)' }}
            onClick={closeRequest}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Request to add company</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>An admin will review and approve</p>
                </div>
                <button onClick={closeRequest} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
              </div>

              {reqDone ? (
                <div className="py-4 text-center">
                  <p className="text-sm font-medium" style={{ color: 'oklch(0.72 0.19 155)' }}>Request submitted!</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Admin will add it soon</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Company name</label>
                    <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                      {requestModal.name}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role(s) *</label>
                    <div className="flex gap-2 flex-wrap">
                      {ALL_TYPES.map(t => {
                        const active = reqTypes.includes(t)
                        return (
                          <button key={t} type="button" onClick={() => toggleReqType(t)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                            style={{
                              background: active ? 'oklch(0.65 0.18 270 / 0.15)' : 'var(--surface-3)',
                              color: active ? 'var(--brand-primary)' : 'var(--text-muted)',
                              border: `1px solid ${active ? 'oklch(0.65 0.18 270 / 0.3)' : 'transparent'}`,
                            }}
                          >
                            {TYPE_LABELS[t]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>City</label>
                      <input type="text" value={reqCity} onChange={e => setReqCity(e.target.value)} placeholder="Dubai"
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Country</label>
                      <input type="text" value={reqCountry} onChange={e => setReqCountry(e.target.value)} placeholder="UAE"
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>

                  {reqError && <p className="text-xs" style={{ color: 'var(--status-not-comply)' }}>{reqError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button onClick={closeRequest} className="flex-1 py-2 rounded-lg text-sm font-medium"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                      Cancel
                    </button>
                    <button onClick={submitRequest} disabled={reqSaving || reqTypes.length === 0}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)', opacity: reqSaving || reqTypes.length === 0 ? 0.5 : 1 }}>
                      {reqSaving ? 'Submitting…' : 'Submit Request'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
