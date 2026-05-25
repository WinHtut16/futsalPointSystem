import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRealtimePoints(userId: string, initialPoints: number): number {
  const [points, setPoints] = useState(initialPoints)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`profile-points-${userId}`)
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
