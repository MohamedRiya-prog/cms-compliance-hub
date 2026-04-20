'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

interface Props {
  user: { id: string; email: string }
  profile: { full_name: string; role: string } | null
}

export function ProfileClient({ user, profile }: Props) {
  const [name, setName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').upsert({ id: user.id, full_name: name })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Profile</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Your account details</p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-5 border mb-4"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: 'oklch(0.65 0.18 270 / 0.2)', color: 'var(--brand-primary)' }}
          >
            {(name || user.email)[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{name || 'No name set'}</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
            <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block capitalize" style={{ background: 'oklch(0.65 0.18 270 / 0.15)', color: 'var(--brand-primary)' }}>
              {profile?.role ?? 'coordinator'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3.5 py-2.5 rounded-lg text-sm opacity-50 cursor-not-allowed"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
          <motion.button
            type="submit"
            disabled={saving}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: saved ? 'var(--status-comply)' : 'var(--brand-primary)', color: 'oklch(0.98 0.002 260)' }}
          >
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
