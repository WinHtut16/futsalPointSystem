import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Gift, Receipt } from 'lucide-react'
import PointsCard from '@/components/customer/PointsCard'
import TransactionItem from '@/components/customer/TransactionItem'
import T from '@/components/ui/T'
import Link from 'next/link'
import type { PointTransaction } from '@/types'

export default async function DashboardPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: transactions } = await supabase
    .from('point_transactions')
    .select('*, reward:rewards(name)')
    .eq('customer_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const txList = (transactions ?? []) as PointTransaction[]

  return (
    <div className="px-4 py-5 space-y-4">
      <PointsCard
        initialPoints={profile.total_points}
        username={profile.username}
        phone={profile.phone ?? ''}
        userId={profile.id}
      />

      {/* Recent Activity */}
      <div className="fb-card overflow-hidden">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 2px',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
            color: 'var(--color-text-primary)',
          }}>
            <T k="dashboard.recentActivity" />
          </span>
          <Link href="/history" style={{
            fontSize: 12, color: 'var(--color-primary)',
            fontWeight: 600, textDecoration: 'none',
            fontFamily: 'var(--font-display)',
          }}>
            <T k="dashboard.viewAll" />
          </Link>
        </div>

        {txList.length > 0 ? (
          txList.map((tx, i) => (
            <TransactionItem key={tx.id} tx={tx} last={i === txList.length - 1} />
          ))
        ) : (
          <div style={{
            textAlign: 'center', padding: '40px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Receipt size={24} strokeWidth={1.8} />
            </div>
            <p style={{
              fontSize: 13, color: 'var(--color-text-muted)', margin: 0,
              fontFamily: 'var(--font-display)',
            }}>
              <T k="dashboard.noActivity" />
            </p>
          </div>
        )}
      </div>

      {/* Spend CTA */}
      <div className="fb-card" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
      }}>
        <p style={{
          fontSize: 13, color: 'var(--color-text-muted)', margin: 0,
          fontFamily: 'var(--font-display)',
        }}>
          <T k="dashboard.spendPoints" />
        </p>
        <Link href="/rewards" className="fb-btn fb-btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>
          <Gift size={14} />
          <T k="dashboard.viewRewards" />
        </Link>
      </div>
    </div>
  )
}
