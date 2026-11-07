import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import type { Reward } from '@/types'
import { FUTSAL } from '@/lib/points'

export const getActiveRewards = unstable_cache(
  async (): Promise<Reward[]> => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('app', FUTSAL)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('points_cost', { ascending: true })
    return (data ?? []) as Reward[]
  },
  ['active-rewards'],
  { revalidate: 30, tags: ['rewards'] }
)
