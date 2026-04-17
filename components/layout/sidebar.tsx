'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, FolderOpen, Settings, ChevronLeft, ChevronRight,
  LogOut, Package, BookOpen, Building2, Menu, X, Sun, Moon, BarChart2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme-provider'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects/new', label: 'New Project', icon: FolderOpen },
]

const settingsItems = [
  { href: '/settings/profile',   label: 'Profile',    icon: Settings,   adminOnly: false },
  { href: '/settings/products',  label: 'Products',   icon: Package,    adminOnly: false },
  { href: '/settings/rules',     label: 'Rules',      icon: BookOpen,   adminOnly: true  },
  { href: '/settings/companies', label: 'Companies',  icon: Building2,  adminOnly: true  },
]

const adminNavItems = [
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
]

interface SidebarProps {
  userEmail?: string
  userName?: string
  userRole?: string
}

// ── Shared nav link renderer ────────────────────────────────────────────────
function NavLinks({
  isAdmin,
  pathname,
  compact,
  onNavigate,
}: {
  isAdmin: boolean
  pathname: string
  compact: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
      {navItems.map(item => {
        const Icon = item.icon
        const active = pathname === item.href
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <motion.div
              whileHover={{ x: compact ? 0 : 2 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all relative',
                active ? 'font-medium' : 'hover:bg-[var(--surface-2)]'
              )}
              style={{
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: active ? 'var(--surface-3)' : 'transparent',
              }}
            >
              <Icon size={16} className="shrink-0" />
              <AnimatePresence>
                {!compact && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {active && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                  style={{ background: 'var(--brand-primary)' }}
                />
              )}
            </motion.div>
          </Link>
        )
      })}

      {/* Settings section */}
      <div className="pt-4 pb-1">
        <AnimatePresence>
          {!compact && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-2.5 text-xs font-medium uppercase tracking-wider mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Settings
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {settingsItems.filter(item => !item.adminOnly || isAdmin).map(item => {
        const Icon = item.icon
        const active = pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <motion.div
              whileHover={{ x: compact ? 0 : 2 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all relative',
                active ? 'font-medium' : 'hover:bg-[var(--surface-2)]'
              )}
              style={{
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: active ? 'var(--surface-3)' : 'transparent',
              }}
            >
              <Icon size={16} className="shrink-0" />
              <AnimatePresence>
                {!compact && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </Link>
        )
      })}

      {/* Admin section */}
      {isAdmin && (
        <>
          <div className="pt-4 pb-1">
            <AnimatePresence>
              {!compact && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2.5 text-xs font-medium uppercase tracking-wider mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Admin
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          {adminNavItems.map(item => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate}>
                <motion.div
                  whileHover={{ x: compact ? 0 : 2 }}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all relative',
                    active ? 'font-medium' : 'hover:bg-[var(--surface-2)]'
                  )}
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active ? 'var(--surface-3)' : 'transparent',
                  }}
                >
                  <Icon size={16} className="shrink-0" />
                  <AnimatePresence>
                    {!compact && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {active && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                      style={{ background: 'var(--brand-primary)' }}
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </>
      )}
    </nav>
  )
}

// ── Logo mark ───────────────────────────────────────────────────────────────
function LogoMark() {
  return (
    <motion.div
      className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 overflow-hidden"
      whileHover={{ scale: 1.05 }}
    >
      <img src="/logo.png" alt="CMS Logo" className="w-full h-full object-contain" />
    </motion.div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function Sidebar({ userEmail, userName, userRole }: SidebarProps) {
  const isAdmin = userRole === 'admin'
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router   = useRouter()
  const { theme, toggleTheme } = useTheme()

  // Close drawer on navigation
  useEffect(() => { setMobileOpen(false) }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const userFooter = (compact: boolean) => (
    <div className="p-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className={cn('flex items-center gap-2.5 px-2.5 py-2 mb-1', compact && 'justify-center')}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'oklch(0.65 0.18 270 / 0.2)', color: 'var(--brand-primary)' }}
        >
          {(userName ?? userEmail ?? 'U')[0].toUpperCase()}
        </div>
        <AnimatePresence>
          {!compact && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{userName ?? 'User'}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{userEmail}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className={cn('flex gap-1', compact ? 'flex-col' : 'flex-row')}>
        <button
          onClick={toggleTheme}
          className={cn('flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all hover:bg-[var(--surface-2)]', compact ? 'justify-center w-full' : 'flex-1')}
          style={{ color: 'var(--text-secondary)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          <AnimatePresence>
            {!compact && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          onClick={handleLogout}
          className={cn('flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all hover:bg-[var(--surface-2)]', compact ? 'justify-center w-full' : '')}
          style={{ color: 'var(--text-secondary)' }}
          title="Sign out"
        >
          <LogOut size={16} className="shrink-0" />
          <AnimatePresence>
            {!compact && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Sign Out</motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      <div className="hidden md:block shrink-0">
        <motion.aside
          animate={{ width: collapsed ? 64 : 240 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex flex-col h-screen relative z-20"
          style={{ background: 'var(--surface-1)', borderRight: '1px solid var(--border-subtle)' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 p-4 h-14 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <LogoMark />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-semibold whitespace-nowrap overflow-hidden"
                  style={{ color: 'var(--text-primary)' }}
                >
                  CMS Compliance Hub
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <NavLinks isAdmin={isAdmin} pathname={pathname} compact={collapsed} />
          {userFooter(collapsed)}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center border transition-all hover:scale-110 z-30"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </motion.aside>
      </div>

      {/* ── MOBILE TOP BAR ──────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center h-14 px-4 border-b"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg mr-3 transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Menu size={20} />
        </button>
        <LogoMark />
        <span className="ml-2.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          CMS Compliance Hub
        </span>
      </div>

      {/* ── MOBILE DRAWER ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="md:hidden fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: 'oklch(0 0 0 / 0.5)' }}
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer panel */}
            <motion.aside
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col w-72"
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              style={{ background: 'var(--surface-1)', borderRight: '1px solid var(--border-subtle)' }}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between p-4 h-14 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2.5">
                  <LogoMark />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>CMS Compliance Hub</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <NavLinks isAdmin={isAdmin} pathname={pathname} compact={false} onNavigate={() => setMobileOpen(false)} />
              {userFooter(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
