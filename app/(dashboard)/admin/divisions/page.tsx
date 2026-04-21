'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Layers } from 'lucide-react'

interface Division {
  id: string
  name: string
}

export default function AdminDivisionsPage() {
  const [divisions, setDivisions] = useState<Division[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/divisions')
    const data = await res.json()
    setDivisions(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/admin/divisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to add')
    } else {
      setNewName('')
      await load()
    }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/admin/divisions?id=${id}`, { method: 'DELETE' })
    setDivisions(prev => prev.filter(d => d.id !== id))
    setDeleting(null)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="shrink-0 border-b px-6 pt-5 pb-4" style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Divisions</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage product/project divisions. Projects and users are scoped to these divisions.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-xl">
        {/* Add form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Division name (e.g. Fire & Smoke Control)"
            className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          />
          <motion.button
            type="submit"
            disabled={adding || !newName.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)', opacity: adding || !newName.trim() ? 0.6 : 1 }}
          >
            <Plus size={14} />
            Add
          </motion.button>
        </form>

        {error && (
          <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)' }}>
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : divisions.length === 0 ? (
          <div className="flex flex-col items-center py-16" style={{ color: 'var(--text-muted)' }}>
            <Layers size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No divisions yet. Add one above.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <AnimatePresence initial={false}>
              {divisions.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between px-5 py-3.5 border-b"
                  style={{ background: i % 2 === 0 ? 'var(--surface-0)' : 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'oklch(0.62 0.17 240)' }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(d.id)}
                    disabled={deleting === d.id}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--status-not-comply)' }}
                    title="Delete division"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
