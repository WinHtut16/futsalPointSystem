'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Award, Phone, LogOut, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'NW'
}

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MY_MONTHS = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ']
const MY_DIGITS = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉']
const toMyDigits = (n: number) => String(n).replace(/\d/g, (d) => MY_DIGITS[+d])

interface AccountHeaderProps {
  name: string
  userId: string
  initialPoints: number
  earned: number
  redeemed: number
  joinedISO: string
  phone?: string | null
}

// Compact identity + flat points strip (no tiers). Points stay live via the
// same profiles realtime + 20s polling pattern as PointsCard.
export default function AccountHeader({ name, userId, initialPoints, earned, redeemed, joinedISO, phone }: AccountHeaderProps) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [points, setPoints] = useState(initialPoints)
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const jd = new Date(joinedISO)
  const joinedLabel = !isNaN(jd.getTime())
    ? (lang === 'my' ? `${MY_MONTHS[jd.getMonth()]} ${toMyDigits(jd.getFullYear())}` : `${EN_MONTHS[jd.getMonth()]} ${jd.getFullYear()}`)
    : ''

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`account-points-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as { id: string; total_points: number }
          if (updated.id === userId) setPoints(updated.total_points)
        }
      )
      .subscribe()

    const timer = setInterval(async () => {
      const { data } = await supabase.from('profiles').select('total_points').eq('id', userId).single()
      if (data) setPoints(data.total_points)
    }, 20_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [userId])

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-3">
        <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-lg font-bold text-primary">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-display text-lg font-extrabold leading-tight tracking-tight text-ink-primary ${my}`}>{name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <Award size={12} />
            <span className={my}>{t('account.memberSince', { date: joinedLabel })}</span>
          </div>
          {phone && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
              <Phone size={12} />
              <span>{phone}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="relative mt-3.5 overflow-hidden rounded-[var(--r-lg)] px-4 pb-3.5 pt-3.5 text-white"
        style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
      >
        <svg viewBox="0 0 200 100" className="absolute -top-3 right-[-8px] w-[150px] opacity-[0.12]">
          <rect x="10" y="10" width="180" height="80" stroke="#fff" strokeWidth="1.2" fill="none" />
          <line x1="100" y1="10" x2="100" y2="90" stroke="#fff" strokeWidth="0.8" />
          <circle cx="100" cy="50" r="14" stroke="#fff" strokeWidth="0.8" fill="none" />
        </svg>
        <div className="relative flex items-center justify-between">
          <div>
            <div className={`font-display text-[10px] font-bold uppercase tracking-[0.14em] opacity-70 ${my}`}>
              {t('account.yourPoints')}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-[30px] font-extrabold leading-none tracking-tight">{points.toLocaleString('en-US')}</span>
              <span className={`text-xs opacity-80 ${my}`}>{t('rewards.pts')}</span>
            </div>
          </div>
          <div className="flex gap-[18px] text-right">
            <div>
              <div className="font-display text-[15px] font-extrabold">{earned.toLocaleString('en-US')}</div>
              <div className={`mt-px text-[9.5px] font-medium opacity-70 ${my}`}>{t('account.earned')}</div>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <div className="font-display text-[15px] font-extrabold">{redeemed.toLocaleString('en-US')}</div>
              <div className={`mt-px text-[9.5px] font-medium opacity-70 ${my}`}>{t('account.redeemed')}</div>
            </div>
          </div>
        </div>
        <div className={`relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium ${my}`}>
          <Zap size={13} className="text-accent" />
          {t('account.earnRate')}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] border border-red-200 py-2.5 text-[12.5px] font-semibold text-red-500 transition-colors hover:border-red-300 hover:bg-red-50"
      >
        <LogOut size={14} strokeWidth={2} />
        <span className={my}>{t('nav.logout')}</span>
      </button>
    </div>
  )
}
