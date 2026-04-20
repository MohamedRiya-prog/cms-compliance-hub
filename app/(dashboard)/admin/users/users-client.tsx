'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Shield, ClipboardCheck, Wrench, Search, X } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface UserRow {
  id: string
  email: string
  fullName: string | null
  role: string
  createdAt: string
  lastSignIn: string | null
}

interface Props {
  users: UserRow[]
  currentUserId: string
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string; desc: string }> = {
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'oklch(0.65 0.18 270)',
    bg: 'oklch(0.65 0.18 270 / 0.10)',
    border: 'oklch(0.65 0.18 270 / 0.30)',
    desc: 'Full platform access, manages users and settings',
  },
  coordinator: {
    label: 'Coordinator',
    icon: ClipboardCheck,
    color: 'oklch(0.72 0.19 155)',
    bg: 'oklch(0.72 0.19 155 / 0.10)',
    border: 'oklch(0.72 0.19 155 / 0.30)',
    desc: 'Creates compliance reports, sends for verification',
  },
  engineer: {
    label: 'Engineer',
    icon: Wrench,
    color: 'oklch(0.78 0.16 85)',
    bg: 'oklch(0.78 0.16 85 / 0.10)',
    border: 'oklch(0.78 0.16 85 / 0.30)',
    desc: 'Reviews and verifies compliance reports',
  },
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.engineer
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

export function UsersClient({ users: initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')

  const sq = search.trim().toLowerCase()
  const filtered = sq
    ? users.filter(u =>
        u.email.toLowerCase().includes(sq) ||
        (u.fullName ?? '').toLowerCase().includes(sq)
      )
    : users

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdating(userId)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to update role')
        return
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } finally {
      setUpdating(null)
    }
  }

  const counts = {
    admin: users.filter(u => u.role === 'admin').length,
    coordinator: users.filter(u => u.role === 'coordinator').length,
    engineer: users.filter(u => u.role === 'engineer').length,
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Summary */}
      <div className="flex items-center gap-6 mb-6">
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const Icon = cfg.icon
          return (
            <div key={role} className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <Icon size={14} style={{ color: cfg.color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cfg.label}s</p>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {counts[role as keyof typeof counts]}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Role description cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const Icon = cfg.icon
          return (
            <div
              key={role}
              className="flex items-start gap-3 px-4 py-3 rounded-xl border"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <Icon size={13} style={{ color: cfg.color }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{cfg.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cfg.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users…"
          className="w-full pl-8 pr-8 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)' }}>
          {error}
        </p>
      )}

      {/* User table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
        {/* Header */}
        <div
          className="grid text-xs font-medium px-5 py-2.5 border-b"
          style={{
            gridTemplateColumns: '1fr 120px 160px 100px',
            color: 'var(--text-muted)',
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span>User</span>
          <span>Current Role</span>
          <span>Change Role</span>
          <span className="text-right">Last Sign In</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center" style={{ background: 'var(--surface-0)' }}>
            <Users size={28} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No users found</p>
          </div>
        ) : (
          filtered.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid items-center px-5 py-3.5 border-b"
              style={{
                gridTemplateColumns: '1fr 120px 160px 100px',
                background: 'var(--surface-0)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {/* Identity */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: 'oklch(0.65 0.18 270 / 0.15)', color: 'var(--brand-primary)' }}
                  >
                    {(u.fullName ?? u.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {u.fullName && (
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.fullName}</p>
                    )}
                    <p className="text-xs truncate" style={{ color: u.fullName ? 'var(--text-muted)' : 'var(--text-primary)' }}>{u.email}</p>
                  </div>
                  {u.id === currentUserId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
                      you
                    </span>
                  )}
                </div>
              </div>

              {/* Current role badge */}
              <div>
                <RoleBadge role={u.role} />
              </div>

              {/* Role selector */}
              <div>
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                  disabled={updating === u.id || u.id === currentUserId}
                  className="text-xs px-2.5 py-1.5 rounded-lg outline-none w-full"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    opacity: u.id === currentUserId ? 0.5 : 1,
                  }}
                >
                  <option value="coordinator">Coordinator</option>
                  <option value="engineer">Engineer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Last sign in */}
              <p className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                {u.lastSignIn ? formatRelativeTime(u.lastSignIn) : 'Never'}
              </p>
            </motion.div>
          ))
        )}
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        {users.length} user{users.length !== 1 ? 's' : ''} total · You cannot change your own role
      </p>
    </div>
  )
}
