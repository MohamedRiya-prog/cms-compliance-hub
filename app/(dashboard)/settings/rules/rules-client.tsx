'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, Eye, Edit3 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function RulesClient() {
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')

  useEffect(() => {
    fetch('/api/admin/rules')
      .then(r => r.json())
      .then(d => { setContent(d?.content ?? ''); setSavedContent(d?.content ?? ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    } else {
      setSaved(true)
      setSavedContent(content)
      setMode('preview')
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0 border-b"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Compliance Rules</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Rules applied to every generated compliance report
          </p>
        </div>

        <div className="flex items-center gap-2">
          {error && <span className="text-xs" style={{ color: 'var(--status-not-comply)' }}>{error}</span>}

          {/* Preview / Edit toggle */}
          <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: 'var(--surface-2)' }}>
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
          </div>

          {mode === 'edit' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <button
                onClick={() => { setContent(savedContent); setMode('preview'); setError('') }}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                Cancel
              </button>
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
                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Rules'}
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="h-full p-6">
            <div className="h-full rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
          </div>
        ) : mode === 'edit' ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full h-full p-6 text-sm font-mono resize-none outline-none"
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
  )
}
