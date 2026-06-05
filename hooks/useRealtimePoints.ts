import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRealtimePoints(userId: string, initialPoints: number): number {
  const [points, setPoints] = useState(initialPoints)
  const lastUpdatedAt = useRef<string>('')

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`profile-points-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as { id: string; total_points: number; updated_at: string }
          if (updated.id !== userId) return
          // Ignore out-of-order events: only apply if this event is newer than the last one.
          if (updated.updated_at <= lastUpdatedAt.current) return
          lastUpdatedAt.current = updated.updated_at
          setPoints(updated.total_points)
        }
      )
      .subscribe()

    const timer = setInterval(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', userId)
        .single()
      if (data) setPoints(data.total_points)
    }, 20_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [userId])

  return points
}
