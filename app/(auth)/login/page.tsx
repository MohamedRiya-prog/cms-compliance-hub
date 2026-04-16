'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      {/* Aurora background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-pulse"
          style={{ background: 'radial-gradient(circle, oklch(0.65 0.18 270), transparent)' }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl animate-pulse"
          style={{ background: 'radial-gradient(circle, oklch(0.72 0.15 250), transparent)', animationDelay: '1s' }}
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
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: 'oklch(0.65 0.18 270 / 0.15)', border: '1px solid oklch(0.65 0.18 270 / 0.3)' }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M4 20L10 8L16 14L22 6" stroke="oklch(0.65 0.18 270)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="22" cy="6" r="2.5" fill="oklch(0.72 0.19 155)"/>
              </svg>
            </motion.div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              CMS Compliance Hub
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full px-3.5 py-2.5 rounded-lg text-sm transition-all outline-none focus:ring-2"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  '--tw-ring-color': 'oklch(0.65 0.18 270 / 0.4)',
                } as React.CSSProperties}
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
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm transition-all outline-none focus:ring-2"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                } as React.CSSProperties}
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
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all mt-2"
              style={{
                background: loading ? 'oklch(0.65 0.18 270 / 0.5)' : 'oklch(0.65 0.18 270)',
                color: 'oklch(0.98 0.002 260)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </motion.button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
              Register
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
