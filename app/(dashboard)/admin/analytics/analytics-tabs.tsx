'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Building2 } from 'lucide-react'

const TABS = [
  { href: '/admin/analytics',             label: 'Overview',     icon: BarChart2  },
  { href: '/admin/analytics/consultants', label: 'Consultants',  icon: Building2  },
]

export function AnalyticsTabs() {
  const pathname = usePathname()

  return (
    <div
      className="shrink-0 border-b px-6"
      style={{ borderColor: 'var(--border-default)', background: 'var(--surface-0)' }}
    >
      <div className="pt-5 pb-0">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Analytics
        </h1>
        <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
          Platform-wide compliance insights
        </p>
      </div>

      <div className="flex gap-0">
        {TABS.map(tab => {
          const active = tab.href === '/admin/analytics'
            ? pathname === '/admin/analytics'
            : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <Link key={tab.href} href={tab.href}>
              <div
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all"
                style={{
                  borderColor: active ? 'var(--brand-primary)' : 'transparent',
                  color: active ? 'var(--brand-primary)' : 'var(--text-muted)',
                  marginBottom: -1,
                }}
              >
                <Icon size={13} />
                {tab.label}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
