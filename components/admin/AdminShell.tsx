'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CalendarCheck, LayoutGrid, Star, Gift, Users, FileText, ShieldCheck,
  MoreHorizontal, ChevronsLeft, ChevronsRight, DatabaseBackup, ScrollText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AppGrant, AppRole } from '@/lib/apps'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'
import { usePendingBookings } from '@/contexts/PendingBookingsContext'
import LanguageToggle from '@/components/ui/LanguageToggle'
import LogoutButton from '@/components/admin/LogoutButton'
import Sheet from '@/components/ui/Sheet'

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
  { labelKey: 'admin.groupData', items: [
    { href: '/admin/audit', labelKey: 'audit.navAudit', Icon: ScrollText, superadmin: true },
    { href: '/admin/export', labelKey: 'admin.navBackup', Icon: DatabaseBackup, superadmin: true },
  ] },
]

// The 4 tabs pinned to the mobile bottom bar — the destinations a futsal
// admin reaches daily. Everything else (Court, News, and the superadmin-only
// group) lives one tap away in the More sheet. See DESIGN.md's Nav section:
// max 5 tabs, 4 primary + More.
const NAV_PRIMARY: NavItem[] = [
  { href: '/admin/dashboard', labelKey: 'admin.navDashboard', Icon: LayoutDashboard },
  { href: '/admin/bookings', labelKey: 'admin.navBookings', Icon: CalendarCheck, bookingBadge: true },
  { href: '/admin/redemptions', labelKey: 'admin.navRequests', Icon: Gift, badge: true },
  { href: '/admin/customers', labelKey: 'admin.navCustomers', Icon: Users },
]

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'AD'
}

export default function AdminShell({
  role,
  username,
  apps,
  children,
}: {
  /** Rank within futsal specifically - drives the superadmin-only nav items
   *  and the label under the username. Not the global profiles.role. */
  role: AppRole
  username: string
  /** Businesses this account can reach. Drives the switcher; empty or single
   *  means no switcher is shown at all. */
  apps: AppGrant[]
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [more, setMore] = useState(false)
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const pathname = usePathname()
  const { count } = usePendingRedemptions()
  const { count: bookingCount } = usePendingBookings()

  const sidebarW = collapsed ? 68 : 248

  useEffect(() => {
    const total = count + bookingCount
    document.title = (total > 0 ? '(!) ' : '') + 'Mya Thida Admin'
  }, [count, bookingCount])

  return (
    <div data-font-scope="admin" className="flex min-h-screen bg-gray-50">
      {/* desktop sidebar — fixed full height */}
      <aside
        className="hidden md:block fixed inset-y-0 left-0 z-nav transition-[width] duration-200"
        style={{ width: sidebarW }}
      >
        <Sidebar role={role} username={username} apps={apps} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>

      <div
        className="flex min-w-0 flex-1 flex-col transition-[margin] duration-200 md:[margin-left:var(--sidebar-w)]"
        style={{ '--sidebar-w': `${sidebarW}px` } as React.CSSProperties}
      >
        {/* topbar */}
        <header className="sticky top-0 z-sticky flex h-[var(--topbar-h)] items-center gap-3 border-b border-line bg-surface px-4 shadow-sm">
          <div className="md:hidden font-display text-[15px] font-extrabold text-ink-primary">Mya Thida</div>
          <div className="ml-auto flex items-center gap-3">
            <LanguageToggle variant="admin" />
            <LogoutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-dashboard flex-1 px-4 py-6 pb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom)+1.5rem)] md:pb-6">
          {children}
        </main>
      </div>

      {/* mobile bottom nav — replaces the old drawer. See DESIGN.md. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-nav grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ height: 'var(--bottomnav-h)' }}
      >
        {NAV_PRIMARY.map((it) => {
          const active = pathname.startsWith(it.href)
          const badgeText = it.badge ? (count > 99 ? '99+' : String(count)) : it.bookingBadge ? (bookingCount > 99 ? '99+' : String(bookingCount)) : null
          const showBadge = (it.badge && count > 0) || (it.bookingBadge && bookingCount > 0)
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center justify-center gap-0.5 ${active ? 'text-primary' : 'text-ink-muted'}`}
            >
              <span className="relative flex">
                <it.Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
                {showBadge && (
                  <span
                    className="absolute -right-2 -top-1.5 flex min-w-[15px] items-center justify-center rounded-full px-1 font-display text-[9px] font-extrabold"
                    style={{ height: 15, background: 'var(--color-accent)', color: '#1a1408' }}
                  >
                    {badgeText}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-semibold ${my}`}>{t(it.labelKey as never).split(' ')[0]}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-ink-muted"
        >
          <MoreHorizontal size={20} strokeWidth={1.9} />
          <span className={`text-[10px] font-semibold ${my}`}>{t('common.more')}</span>
        </button>
      </nav>

      {/* "More" sheet — the rest of the sidebar's contents, for phones */}
      <Sheet open={more} onClose={() => setMore(false)} title={t('common.more')} className="max-h-[80vh] overflow-y-auto">
        <MoreMenu role={role} username={username} apps={apps} onNavigate={() => setMore(false)} />
      </Sheet>
    </div>
  )
}

function MoreMenu({
  role,
  username,
  apps,
  onNavigate,
}: {
  role: AppRole
  username: string
  apps: AppGrant[]
  onNavigate: () => void
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const pathname = usePathname()
  const { count } = usePendingRedemptions()
  const { count: bookingCount } = usePendingBookings()
  const primaryHrefs = new Set(NAV_PRIMARY.map((it) => it.href))

  return (
    <div className="pb-2">
      {NAV.map((group, gi) => {
        const items = group.items.filter((it) => (!it.superadmin || role === 'superadmin') && !primaryHrefs.has(it.href))
        if (items.length === 0) return null
        return (
          <div key={gi} className="mb-3">
            {group.labelKey && (
              <div className={`px-1 pb-1.5 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint ${my}`}>
                {t(group.labelKey as never)}
              </div>
            )}
            {items.map((it) => {
              const active = pathname.startsWith(it.href)
              const badgeText = it.badge ? (count > 99 ? '99+' : String(count)) : it.bookingBadge ? (bookingCount > 99 ? '99+' : String(bookingCount)) : null
              const showBadge = (it.badge && count > 0) || (it.bookingBadge && bookingCount > 0)
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-[9px] px-3 py-2.5 ${active ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-surface-alt'}`}
                >
                  <span className="relative flex shrink-0">
                    <it.Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
                    {showBadge && (
                      <span
                        className="absolute -right-[7px] -top-1.5 flex min-w-[15px] items-center justify-center rounded-full px-1 font-display text-[9px] font-extrabold"
                        style={{ height: 15, background: 'var(--color-accent)', color: '#1a1408' }}
                      >
                        {badgeText}
                      </span>
                    )}
                  </span>
                  <span className={`text-[13px] font-medium ${my}`}>{t(it.labelKey as never)}</span>
                </Link>
              )
            })}
          </div>
        )
      })}

      {apps.length > 1 && (
        <Link
          href="/admin/apps"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-ink hover:bg-surface-alt"
        >
          <LayoutGrid size={18} strokeWidth={1.9} className="shrink-0" />
          <span className={`text-[13px] font-medium ${my}`}>{t('portal.switchApp')}</span>
        </Link>
      )}

      <div className="mt-2 flex items-center gap-2.5 border-t border-line px-1 pt-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-alt font-display text-xs font-bold text-ink">
          {initials(username)}
        </div>
        <Link href="/admin/profile" onClick={onNavigate} className="min-w-0 flex-1">
          <div className="truncate font-display text-[13px] font-bold text-ink">{username}</div>
          <div className="text-[11px] capitalize text-ink-muted">{role}</div>
        </Link>
      </div>
    </div>
  )
}

function Sidebar({
  role,
  username,
  apps,
  collapsed,
  onToggle,
}: {
  role: AppRole
  username: string
  apps: AppGrant[]
  collapsed: boolean
  onToggle: () => void
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const pathname = usePathname()
  const { count } = usePendingRedemptions()
  const badgeText = count > 99 ? '99+' : String(count)
  const { count: bookingCount } = usePendingBookings()
  const bookingBadgeText = bookingCount > 99 ? '99+' : String(bookingCount)

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
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft size={15} />
          </button>
        )}
      </div>

      {/* business switcher — only when this account can reach more than one.
          A single-business staffer should never see that the others exist. */}
      {apps.length > 1 && (
        <Link
          href="/admin/apps"
          title={t('portal.switchApp')}
          className={`flex items-center gap-2.5 border-b border-white/10 text-white/70 transition-colors hover:bg-white/10 hover:text-white ${
            collapsed ? 'justify-center px-0 py-3' : 'px-4 py-2.5'
          }`}
        >
          <LayoutGrid size={16} className="shrink-0" strokeWidth={2} />
          {!collapsed && (
            <span className={`truncate text-[12px] font-semibold ${my}`}>{t('portal.switchApp')}</span>
          )}
        </Link>
      )}

      {/* nav */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2.5 py-3' : 'px-3 py-3'}`}>
        {collapsed && (
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
