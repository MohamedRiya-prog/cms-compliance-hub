'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { BarChart2, Building2 } from 'lucide-react'

const TABS = [
  { href: '/admin/analytics',             label: 'Overview',    icon: BarChart2 },
  { href: '/admin/analytics/consultants', label: 'Consultants', icon: Building2 },
]

export function AnalyticsTabs() {
  const pathname = usePathname()

  return (
    <div
      className="shrink-0 border-b px-6 pt-5 pb-4"
      style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}
    >
      {/* Page title */}
      <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Analytics
      </h1>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Platform-wide compliance insights
      </p>

      {/* Pill tab switcher */}
      <div
        className="inline-flex items-center gap-0.5 p-1 rounded-xl"
        style={{ background: 'var(--surface-2)' }}
      >
        {TABS.map(tab => {
          const active = tab.href === '/admin/analytics'
            ? pathname === '/admin/analytics'
            : pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link key={tab.href} href={tab.href}>
              <div className="relative">
                {active && (
                  <motion.div
                    layoutId="analytics-active-tab"
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: 'var(--surface-0)',
                      boxShadow: '0 1px 4px oklch(0 0 0 / 0.12), 0 0 0 1px oklch(0 0 0 / 0.04)',
                    }}
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
                  />
                )}
                <div
                  className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium select-none transition-colors"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    zIndex: 1,
                  }}
                >
                  <Icon size={13} />
                  {tab.label}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
