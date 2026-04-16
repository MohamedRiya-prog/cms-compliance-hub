'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, Lock, Eye, Edit3 } from 'lucide-react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/client'

const FAMILIES = [
  { code: 'ALL',       label: 'All Products',                     group: 'Overview' },
  { code: 'BDD',       label: 'BDD — Backdraft Damper',           group: 'Dampers' },
  { code: 'PRD',       label: 'PRD — Pressure Relief Damper',     group: 'Dampers' },
  { code: 'EVFD',      label: 'EVFD — Curtain Fire Damper',       group: 'Dampers' },
  { code: 'EFD',       label: 'EFD — Motorized Fire Damper',      group: 'Dampers' },
  { code: 'EFSD',      label: 'EFSD — Fire Smoke Damper',         group: 'Dampers' },
  { code: 'ESD',       label: 'ESD — Smoke Damper',               group: 'Dampers' },
  { code: 'ACTUATORS', label: 'Actuators (EFD/EFSD/ESD)',         group: 'Dampers' },
  { code: 'VCD',       label: 'VCD — Volume Control Damper',      group: 'Air Control' },
  { code: 'VCD_C1',    label: 'VCD Class I Leakage',              group: 'Air Control' },
  { code: 'GTD',       label: 'GTD — Gas Tight Damper',           group: 'Air Control' },
  { code: 'VAV',       label: 'VAV — Pressure Independent',       group: 'Air Control' },
  { code: 'LLVCD',     label: 'Low Leakage Aluminum VCD',         group: 'Air Control' },
  { code: 'SA',        label: 'Sound Attenuators',                group: 'Air Distribution' },
  { code: 'SDGR',      label: 'Single/Double Deflection Grilles', group: 'Air Distribution' },
  { code: 'LBG',       label: 'Linear Bar Grilles & Registers',   group: 'Air Distribution' },
  { code: 'LSD',       label: 'Linear Slot Diffusers',            group: 'Air Distribution' },
  { code: 'FBD',       label: 'Flow Bar Diffusers',               group: 'Air Distribution' },
  { code: 'AL',        label: 'Acoustic Louvers',                 group: 'Louvers' },
  { code: 'STL',       label: 'Sand Trap Louvers (STL)',          group: 'Louvers' },
  { code: 'FAL_A',     label: 'Fresh Air Louver (FAL-A)',         group: 'Louvers' },
]

const GROUPS = ['Overview', 'Dampers', 'Air Control', 'Air Distribution', 'Louvers']

export default function ProductsPage() {
  const [selectedFamily, setSelectedFamily] = useState('ALL')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [roleLoading, setRoleLoading] = useState(true)
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')

  useEffect(() => {
    async function fetchRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRoleLoading(false); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setIsAdmin(profile?.role === 'admin')
      setRoleLoading(false)
    }
    fetchRole()
  }, [])

  async function loadFamily(family: string) {
    setLoading(true)
    setContent('')
    setError('')
    try {
      const res = await fetch(`/api/admin/products/${family}`)
      if (res.status !== 404) {
        const data = await res.json()
        setContent(data?.content ?? '')
      }
    } catch {
      setError('Failed to load product data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFamily(selectedFamily) }, [selectedFamily])

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/products/${selectedFamily}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  const selectedLabel = FAMILIES.find(f => f.code === selectedFamily)?.label ?? selectedFamily

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Product Data</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Excelair product datasheets used in the AI system prompt
          </p>
        </div>

        <div className="flex items-center gap-2">
          {error && <span className="text-xs" style={{ color: 'var(--status-not-comply)' }}>{error}</span>}

          {!roleLoading && (
            isAdmin ? (
              <motion.button
                onClick={handleSave}
                disabled={saving || loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{
                  background: saved ? 'var(--status-comply)' : 'var(--brand-primary)',
                  color: 'oklch(0.98 0.002 260)',
                  opacity: saving || loading ? 0.6 : 1,
                }}
              >
                <Save size={13} />
                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
              </motion.button>
            ) : (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
              >
                <Lock size={12} />
                Read-only
              </div>
            )
          )}
        </div>
      </div>

      {/* Split panels */}
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">

        {/* Left — product list */}
        <Panel defaultSize={26} minSize={16} maxSize={42}>
          <div
            className="h-full overflow-y-auto px-3 py-4 space-y-4"
            style={{ background: 'var(--surface-1)' }}
          >
            {GROUPS.map(group => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-1.5"
                  style={{ color: 'var(--text-muted)' }}>
                  {group}
                </p>
                <div className="space-y-0.5">
                  {FAMILIES.filter(f => f.group === group).map(f => (
                    <button
                      key={f.code}
                      onClick={() => setSelectedFamily(f.code)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                      style={{
                        background: selectedFamily === f.code ? 'oklch(0.65 0.18 270 / 0.12)' : 'transparent',
                        color: selectedFamily === f.code ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        borderLeft: selectedFamily === f.code
                          ? '2px solid var(--brand-primary)'
                          : '2px solid transparent',
                        fontWeight: selectedFamily === f.code ? 500 : 400,
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Resize handle */}
        <PanelResizeHandle className="group relative w-1 flex items-center justify-center cursor-col-resize">
          <div
            className="w-px h-full transition-colors group-hover:bg-[var(--brand-primary)]"
            style={{ background: 'var(--border-default)' }}
          />
          <div className="absolute flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full" style={{ background: 'var(--brand-primary)' }} />
            ))}
          </div>
        </PanelResizeHandle>

        {/* Right — preview / editor */}
        <Panel defaultSize={74} minSize={40}>
          <div className="h-full flex flex-col" style={{ background: 'var(--surface-0)' }}>

            {/* Right header with mode toggle */}
            <div
              className="px-5 py-2 shrink-0 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {selectedLabel}
              </span>

              {/* Preview / Edit toggle */}
              {(isAdmin || mode === 'preview') && (
                <div
                  className="flex items-center rounded-lg p-0.5 gap-0.5"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <button
                    onClick={() => setMode('preview')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: mode === 'preview' ? 'var(--surface-3)' : 'transparent',
                      color: mode === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    <Eye size={12} />
                    Preview
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setMode('edit')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                      style={{
                        background: mode === 'edit' ? 'var(--surface-3)' : 'transparent',
                        color: mode === 'edit' ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="h-full p-4">
                  <div className="h-full rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
                </div>
              ) : !content ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No data for <strong>{selectedLabel}</strong>
                    {isAdmin ? ' — switch to Edit to add content.' : ' — contact an admin.'}
                  </p>
                </div>
              ) : mode === 'edit' && isAdmin ? (
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full h-full p-5 text-sm font-mono resize-none outline-none"
                  style={{
                    background: 'var(--surface-1)',
                    color: 'var(--text-primary)',
                    border: 'none',
                  }}
                />
              ) : (
                /* Markdown preview */
                <div className="h-full overflow-y-auto px-8 py-6 prose-products">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="table-outer">
                          <table>{children}</table>
                        </div>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </Panel>

      </PanelGroup>
    </div>
  )
}
