'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CalendarCheck, LayoutGrid, Star, Gift, Users, FileText, ShieldCheck,
  Menu, X, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '@/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'
import { usePendingBookings } from '@/contexts/PendingBookingsContext'
import LanguageToggle from '@/components/ui/LanguageToggle'
import LogoutButton from '@/components/admin/LogoutButton'

type NavItem = { href: string; labelKey: string; Icon: LucideIcon; badge?: boolean; bookingBadge?: boolean; superadmin?: boolean }
type NavGroup = { labelKey?: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { items: [{ href: '/admin/dashboard', labelKey: 'admin.navDashboard', Icon: LayoutDashboard }] },
  { labelKey: 'admin.groupBooking', items: [
    { href: '/admin/bookings', labelKey: 'admin.navBookings', Icon: CalendarCheck, bookingBadge: true },
    { href: '/admin/court', labelKey: 'admin.navCourt', Icon: LayoutGrid },
  ] },
  { labelKey: 'admin.groupLoyalty', items: [
    { href: '/admin/rewards', labelKey: 'admin.navPointsRewards', Icon: Star },
    { href: '/admin/redemptions', labelKey: 'admin.navRequests', Icon: Gift, badge: true },
    { href: '/admin/customers', labelKey: 'admin.navCustomers', Icon: Users },
  ] },
  { labelKey: 'admin.groupContent', items: [
    { href: '/admin/cms', labelKey: 'admin.navNews', Icon: FileText },
    { href: '/admin/staff', labelKey: 'admin.navStaff', Icon: ShieldCheck, superadmin: true },
  ] },
]

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'AD'
}

export default function AdminShell({
  role,
  username,
  children,
}: {
  role: UserRole
  username: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)

  const sidebarW = collapsed ? 68 : 248

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* desktop sidebar — fixed full height */}
      <aside
        className="hidden md:block fixed inset-y-0 left-0 z-30 transition-[width] duration-200"
        style={{ width: sidebarW }}
      >
        <Sidebar role={role} username={username} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0" style={{ background: 'rgba(15,30,22,0.5)' }} />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
            <Sidebar role={role} username={username} collapsed={false} mobile onToggle={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div
        className="flex min-w-0 flex-1 flex-col transition-[margin] duration-200 md:[margin-left:var(--sidebar-w)]"
        style={{ '--sidebar-w': `${sidebarW}px` } as React.CSSProperties}
      >
        {/* topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 shadow-sm">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-primary hover:bg-black/5 transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="md:hidden font-display text-[15px] font-extrabold text-ink-primary">Mya Thida</div>
          <div className="ml-auto flex items-center gap-3">
            <LanguageToggle variant="admin" />
            <LogoutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  )
}

function Sidebar({
  role,
  username,
  collapsed,
  mobile = false,
  onToggle,
}: {
  role: UserRole
  username: string
  collapsed: boolean
  mobile?: boolean
  onToggle: () => void
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const pathname = usePathname()
  const { count } = usePendingRedemptions()
  const badgeText = count > 99 ? '99+' : String(count)
  const { count: bookingCount } = usePendingBookings()
  const bookingBadgeText = bookingCount > 99 ? '99+' : String(bookingCount)

  const BASE_ADMIN_TITLE = 'Mya Thida Admin'
  useEffect(() => {
    const total = count + bookingCount
    document.title = (total > 0 ? '(!) ' : '') + BASE_ADMIN_TITLE
  }, [count, bookingCount])

  return (
    <div
      className="flex h-full flex-col text-white transition-[width] duration-200"
      style={{ width: collapsed ? 68 : 248, background: 'var(--color-primary-dark)' }}
    >
      {/* brand + collapse */}
      <div className={`flex items-center border-b border-white/10 ${collapsed ? 'justify-center px-0 py-4' : 'justify-between px-4 py-4'}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_black.jpg" alt="Mya Thida" className="h-7 w-7 shrink-0 rounded-md object-contain" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-[15px] font-extrabold leading-tight tracking-tight">Mya Thida</div>
              <div className={`text-[10px] font-bold uppercase tracking-[0.08em] text-white/55 ${my}`}>{t('admin.panelSubtitle')}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/20 text-white/70"
            aria-label={mobile ? 'Close menu' : 'Collapse sidebar'}
          >
            {mobile ? <X size={16} /> : <ChevronsLeft size={15} />}
          </button>
        )}
      </div>

      {/* nav */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2.5 py-3' : 'px-3 py-3'}`}>
        {collapsed && !mobile && (
          <button
            type="button"
            onClick={onToggle}
            className="mx-auto mb-2 flex h-10 w-11 items-center justify-center rounded-lg text-white/55"
            aria-label="Expand sidebar"
          >
            <ChevronsRight size={18} />
          </button>
        )}
        {NAV.map((group, gi) => {
          const items = group.items.filter((it) => !it.superadmin || role === 'superadmin')
          if (items.length === 0) return null
          return (
            <div key={gi} className={collapsed ? 'mb-1.5' : 'mb-3.5'}>
              {group.labelKey && !collapsed && (
                <div className={`px-3 pb-1.5 pt-1 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-white/40 ${my}`}>
                  {t(group.labelKey as never)}
                </div>
              )}
              {group.labelKey && collapsed && gi > 0 && <div className="mx-2 mb-2 mt-1.5 h-px bg-white/10" />}
              {items.map((it) => {
                const active = pathname.startsWith(it.href)
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={collapsed ? t(it.labelKey as never) : undefined}
                    className={`relative mb-0.5 flex items-center rounded-[9px] ${collapsed ? 'mx-auto h-11 w-11 justify-center' : 'gap-3 px-3 py-2.5'} ${
                      active ? 'bg-white/[0.14] text-white' : 'text-white/70 hover:bg-white/[0.07]'
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-sm"
                        style={{ left: collapsed ? -10 : -12, background: 'var(--color-slot-available)' }}
                      />
                    )}
                    <span className="relative flex shrink-0">
                      <it.Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
                      {it.badge && count > 0 && (
                        <span
                          className="absolute -right-[7px] -top-1.5 flex min-w-[15px] items-center justify-center rounded-full px-1 font-display text-[9px] font-extrabold"
                          style={{ height: 15, background: 'var(--color-accent)', color: '#1a1408' }}
                        >
                          {badgeText}
                          <span className="sr-only"> pending requests</span>
                        </span>
                      )}
                      {it.bookingBadge && bookingCount > 0 && (
                        <span
                          className="absolute -right-[7px] -top-1.5 flex min-w-[15px] items-center justify-center rounded-full px-1 font-display text-[9px] font-extrabold"
                          style={{ height: 15, background: 'var(--color-accent)', color: '#1a1408' }}
                        >
                          {bookingBadgeText}
                          <span className="sr-only"> pending bookings</span>
                        </span>
                      )}
                    </span>
                    {!collapsed && (
                      <span className={`whitespace-nowrap font-display text-[13px] ${active ? 'font-bold' : 'font-medium'} ${my}`}>
                        {t(it.labelKey as never)}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* user footer */}
      <div className={`flex items-center border-t border-white/10 ${collapsed ? 'justify-center px-0 py-3.5' : 'gap-2.5 px-4 py-3.5'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 font-display text-xs font-bold">
          {initials(username)}
        </div>
        {!collapsed && (
          <Link href="/admin/profile" className="min-w-0 transition-opacity hover:opacity-75">
            <div className="truncate font-display text-[13px] font-bold">{username}</div>
            <div className="text-[11px] capitalize text-white/55">{role}</div>
          </Link>
        )}
      </div>
    </div>
  )
}
