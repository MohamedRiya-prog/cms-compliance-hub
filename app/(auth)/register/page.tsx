'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-15 blur-3xl animate-pulse"
          style={{ background: 'radial-gradient(circle, oklch(0.65 0.18 270), transparent)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-sm mx-4"
      >
        <div
          className="rounded-2xl p-8 border"
          style={{
            background: 'var(--surface-glass)',
            backdropFilter: 'blur(20px)',
            borderColor: 'var(--border-default)',
            boxShadow: '0 24px 64px oklch(0 0 0 / 0.5)',
          }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 overflow-hidden">
              <img src="/logo.png" alt="CMS Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Create Account
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Join CMS Compliance Hub
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="Riyaz Ahmed"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none focus:ring-2"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@cmsglobal.com"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none focus:ring-2"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min 8 characters"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none focus:ring-2"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm px-3 py-2 rounded-lg"
                style={{ background: 'oklch(0.68 0.22 25 / 0.1)', color: 'var(--status-not-comply)', border: '1px solid oklch(0.68 0.22 25 / 0.2)' }}
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 rounded-lg text-sm font-semibold mt-2"
              style={{
                background: loading ? 'oklch(0.65 0.18 270 / 0.5)' : 'oklch(0.65 0.18 270)',
                color: 'oklch(0.98 0.002 260)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </motion.button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
              Sign In
            </Link>
          </p>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Century Mechanical Systems Factory LLC
        </p>
      </motion.div>
    </div>
  )
}
