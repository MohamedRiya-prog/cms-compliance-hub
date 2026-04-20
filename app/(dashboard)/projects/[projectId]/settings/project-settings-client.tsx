'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Project {
  id: string; name: string; client: string | null; location: string | null;
  project_number: string | null; description: string | null; status: string;
  contractor: string | null; main_contractor: string | null; consultant: string | null;
}

export function ProjectSettingsClient({ project }: { project: Project }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: project.name,
    client: project.client ?? '',
    location: project.location ?? '',
    projectNumber: project.project_number ?? '',
    contractor: project.contractor ?? '',
    mainContractor: project.main_contractor ?? '',
    consultant: project.consultant ?? '',
    description: project.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
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
    background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none',
  } as React.CSSProperties

  return (
    <div className="p-6 max-w-xl">
      <Link href={`/projects/${project.id}`}>
        <button className="flex items-center gap-2 text-sm mb-6 hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Back to Project
        </button>
      </Link>
      <h1 className="text-xl font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Project Settings</h1>
      <form onSubmit={handleSave} className="space-y-4">
        {[
          { label: 'Project Name', field: 'name', required: true },
          { label: 'Client', field: 'client' },
          { label: 'Location', field: 'location' },
          { label: 'Project Number', field: 'projectNumber' },
          { label: 'Contractor', field: 'contractor' },
          { label: 'Main Contractor', field: 'mainContractor' },
          { label: 'Consultant', field: 'consultant' },
        ].map(({ label, field, required }) => (
          <div key={field}>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
            <input
              type="text"
              value={(form as Record<string, string>)[field]}
              onChange={e => set(field, e.target.value)}
              required={required}
              style={inputStyle}
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            className="resize-none"
            style={inputStyle}
          />
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
    </div>
  )
}
