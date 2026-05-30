export default function Loading() {
  return (
    <div className="px-4 py-5 space-y-4">
      {/* PointsCard skeleton */}
      <div className="animate-pulse" style={{
        borderRadius: 'var(--r-xl)',
        background: 'var(--color-primary-dark)',
        padding: '22px 20px 20px',
        opacity: 0.6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, width: 100, borderRadius: 6, background: 'rgba(255,255,255,0.18)', marginBottom: 6 }} />
            <div style={{ height: 10, width: 80, borderRadius: 6, background: 'rgba(255,255,255,0.12)' }} />
          </div>
        </div>
        <div style={{ height: 10, width: 80, borderRadius: 4, background: 'rgba(255,255,255,0.15)', marginBottom: 8 }} />
        <div style={{ height: 52, width: 140, borderRadius: 6, background: 'rgba(255,255,255,0.18)' }} />
        <div style={{ height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.12)', marginTop: 18 }} />
      </div>

      {/* Recent Activity skeleton */}
      <div className="fb-card overflow-hidden animate-pulse">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
          <div style={{ height: 14, width: 110, borderRadius: 5, background: 'var(--color-line-strong)' }} />
          <div style={{ height: 12, width: 50, borderRadius: 5, background: 'var(--color-line)' }} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: '1px solid var(--color-line)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--color-line)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 13, width: '55%', borderRadius: 4, background: 'var(--color-line-strong)', marginBottom: 6 }} />
              <div style={{ height: 10, width: '40%', borderRadius: 4, background: 'var(--color-line)' }} />
            </div>
            <div style={{ height: 15, width: 36, borderRadius: 4, background: 'var(--color-line-strong)' }} />
          </div>
        ))}
      </div>

      {/* SpendCTA skeleton */}
      <div className="fb-card animate-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ height: 13, width: 140, borderRadius: 4, background: 'var(--color-line)' }} />
        <div style={{ height: 36, width: 90, borderRadius: 10, background: 'var(--color-line-strong)' }} />
      </div>
    </div>
  )
}
