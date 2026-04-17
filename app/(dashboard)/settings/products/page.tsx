'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, Lock, Eye, Edit3, Plus, Trash2, X } from 'lucide-react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/client'

// Built-in product metadata for display (these have no label stored in DB)
const BUILTIN_META: Record<string, { label: string; group: string }> = {
  ALL:       { label: 'All Products',                     group: 'Overview' },
  BDD:       { label: 'BDD — Backdraft Damper',           group: 'Dampers' },
  PRD:       { label: 'PRD — Pressure Relief Damper',     group: 'Dampers' },
  EVFD:      { label: 'EVFD — Curtain Fire Damper',       group: 'Dampers' },
  EFD:       { label: 'EFD — Motorized Fire Damper',      group: 'Dampers' },
  EFSD:      { label: 'EFSD — Fire Smoke Damper',         group: 'Dampers' },
  ESD:       { label: 'ESD — Smoke Damper',               group: 'Dampers' },
  ACTUATORS: { label: 'Actuators (EFD/EFSD/ESD)',         group: 'Dampers' },
  VCD:       { label: 'VCD — Volume Control Damper',      group: 'Air Control' },
  VCD_C1:    { label: 'VCD Class I Leakage',              group: 'Air Control' },
  GTD:       { label: 'GTD — Gas Tight Damper',           group: 'Air Control' },
  VAV:       { label: 'VAV — Pressure Independent',       group: 'Air Control' },
  LLVCD:     { label: 'Low Leakage Aluminum VCD',         group: 'Air Control' },
  SA:        { label: 'Sound Attenuators',                group: 'Air Distribution' },
  SDGR:      { label: 'Single/Double Deflection Grilles', group: 'Air Distribution' },
  LBG:       { label: 'Linear Bar Grilles & Registers',   group: 'Air Distribution' },
  LSD:       { label: 'Linear Slot Diffusers',            group: 'Air Distribution' },
  FBD:       { label: 'Flow Bar Diffusers',               group: 'Air Distribution' },
  AL:        { label: 'Acoustic Louvers',                 group: 'Louvers' },
  STL:       { label: 'Sand Trap Louvers (STL)',          group: 'Louvers' },
  FAL_A:     { label: 'Fresh Air Louver (FAL-A)',         group: 'Louvers' },
}

const BUILTIN_GROUPS = ['Overview', 'Dampers', 'Air Control', 'Air Distribution', 'Louvers']

interface ProductFamily {
  family: string
  label: string
  group: string
  isCustom: boolean
}

interface AddForm {
  code: string
  label: string
  group: string
  content: string
}

const emptyForm = (): AddForm => ({ code: '', label: '', group: '', content: '' })

export default function ProductsPage() {
  const [families, setFamilies] = useState<ProductFamily[]>([])
  const [familiesLoading, setFamiliesLoading] = useState(true)
  const [selectedFamily, setSelectedFamily] = useState('ALL')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [roleLoading, setRoleLoading] = useState(true)
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')

  // Add product modal
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(emptyForm())
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Load admin role
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

  // Load families from API
  async function fetchFamilies() {
    setFamiliesLoading(true)
    try {
      const res = await fetch('/api/admin/products')
      if (!res.ok) return
      const rows: { family: string; label: string | null; product_group: string | null }[] = await res.json()

      // Build merged list
      const seen = new Set<string>()
      const list: ProductFamily[] = []

      // Built-ins first (in order)
      for (const code of Object.keys(BUILTIN_META)) {
        seen.add(code)
        list.push({
          family: code,
          label: BUILTIN_META[code].label,
          group: BUILTIN_META[code].group,
          isCustom: false,
        })
      }

      // Custom products from DB (those with a label)
      for (const row of rows) {
        if (!seen.has(row.family) && row.label) {
          list.push({
            family: row.family,
            label: row.label,
            group: row.product_group ?? 'Custom',
            isCustom: true,
          })
        }
      }

      setFamilies(list)
    } finally {
      setFamiliesLoading(false)
    }
  }

  useEffect(() => { fetchFamilies() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load content for selected family
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

  async function handleAdd() {
    setAdding(true)
    setAddError('')
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    const d = await res.json()
    if (!res.ok) {
      setAddError(d.error ?? 'Failed to create product')
      setAdding(false)
      return
    }
    setAdding(false)
    setAddOpen(false)
    setAddForm(emptyForm())
    await fetchFamilies()
    setSelectedFamily(d.family)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/admin/products/${deleteTarget}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      setDeleteError(d.error ?? 'Failed to delete')
      setDeleting(false)
      return
    }
    setDeleting(false)
    setDeleteTarget(null)
    await fetchFamilies()
    setSelectedFamily('ALL')
  }

  // Build grouped list for sidebar
  const customFamilies = families.filter(f => f.isCustom)
  const customGroups = [...new Set(customFamilies.map(f => f.group))]
  const allGroups = [...BUILTIN_GROUPS, ...customGroups.filter(g => !BUILTIN_GROUPS.includes(g))]

  const selectedMeta = families.find(f => f.family === selectedFamily)
  const selectedLabel = selectedMeta?.label ?? selectedFamily
  const selectedIsCustom = selectedMeta?.isCustom ?? false

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

          {/* Add Product button (admin only) */}
          {!roleLoading && isAdmin && (
            <motion.button
              onClick={() => { setAddOpen(true); setAddForm(emptyForm()); setAddError('') }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
            >
              <Plus size={13} />
              Add Product
            </motion.button>
          )}

          {/* Delete button for custom products */}
          {!roleLoading && isAdmin && selectedIsCustom && (
            <motion.button
              onClick={() => { setDeleteTarget(selectedFamily); setDeleteError('') }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)', border: '1px solid oklch(0.68 0.22 25 / 0.2)' }}
            >
              <Trash2 size={13} />
              Delete
            </motion.button>
          )}

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
            {familiesLoading ? (
              <div className="space-y-2 px-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
                ))}
              </div>
            ) : (
              allGroups.map(group => {
                const groupFamilies = families.filter(f => f.group === group)
                if (!groupFamilies.length) return null
                return (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-1.5"
                      style={{ color: 'var(--text-muted)' }}>
                      {group}
                    </p>
                    <div className="space-y-0.5">
                      {groupFamilies.map(f => (
                        <button
                          key={f.family}
                          onClick={() => setSelectedFamily(f.family)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between group"
                          style={{
                            background: selectedFamily === f.family ? 'oklch(0.65 0.18 270 / 0.12)' : 'transparent',
                            color: selectedFamily === f.family ? 'var(--brand-primary)' : 'var(--text-secondary)',
                            borderLeft: selectedFamily === f.family
                              ? '2px solid var(--brand-primary)'
                              : '2px solid transparent',
                            fontWeight: selectedFamily === f.family ? 500 : 400,
                          }}
                        >
                          <span>{f.label}</span>
                          {f.isCustom && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded shrink-0 ml-1"
                              style={{ background: 'oklch(0.65 0.18 270 / 0.15)', color: 'var(--brand-primary)', fontSize: '10px' }}
                            >
                              custom
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
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

      {/* Add Product Modal */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'oklch(0 0 0 / 0.6)' }}
            onClick={e => { if (e.target === e.currentTarget) setAddOpen(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-2xl border p-6"
              style={{
                background: 'var(--surface-1)',
                borderColor: 'var(--border-default)',
                boxShadow: '0 24px 64px oklch(0 0 0 / 0.5)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Add New Product Family
                </h2>
                <button
                  onClick={() => setAddOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Product Code <span style={{ color: 'var(--status-not-comply)' }}>*</span>
                  </label>
                  <input
                    value={addForm.code}
                    onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="e.g. CFD or CUSTOM_01"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Will be uppercased and spaces replaced with underscores.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Display Label <span style={{ color: 'var(--status-not-comply)' }}>*</span>
                  </label>
                  <input
                    value={addForm.label}
                    onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="e.g. Ceiling Fire Dampers"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Product Group
                  </label>
                  <input
                    value={addForm.group}
                    onChange={e => setAddForm(f => ({ ...f, group: e.target.value }))}
                    placeholder="e.g. Dampers, Custom, Louvers…"
                    list="group-suggestions"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <datalist id="group-suggestions">
                    {[...BUILTIN_GROUPS, 'Custom'].map(g => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Initial Content <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <textarea
                    value={addForm.content}
                    onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                    rows={4}
                    placeholder="Paste product datasheet content here (Markdown supported)…"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono resize-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {addError && (
                  <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)', border: '1px solid oklch(0.68 0.22 25 / 0.2)' }}>
                    {addError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setAddOpen(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                >
                  Cancel
                </button>
                <motion.button
                  onClick={handleAdd}
                  disabled={adding || !addForm.code.trim() || !addForm.label.trim()}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: 'var(--brand-primary)',
                    color: 'oklch(0.98 0.002 260)',
                    opacity: adding || !addForm.code.trim() || !addForm.label.trim() ? 0.5 : 1,
                  }}
                >
                  {adding ? 'Creating…' : 'Create Product'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'oklch(0 0 0 / 0.6)' }}
            onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-2xl border p-6"
              style={{
                background: 'var(--surface-1)',
                borderColor: 'var(--border-default)',
                boxShadow: '0 24px 64px oklch(0 0 0 / 0.5)',
              }}
            >
              <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Delete product?
              </h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                This will permanently delete <strong>{deleteTarget}</strong> and all its content from the database. This action cannot be undone.
              </p>

              {deleteError && (
                <p className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)', border: '1px solid oklch(0.68 0.22 25 / 0.2)' }}>
                  {deleteError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                >
                  Cancel
                </button>
                <motion.button
                  onClick={handleDelete}
                  disabled={deleting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: 'oklch(0.55 0.22 25)',
                    color: 'white',
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
