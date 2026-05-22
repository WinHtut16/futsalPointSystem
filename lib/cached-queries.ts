import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import type { Reward } from '@/types'

export const getActiveRewards = unstable_cache(
  async (): Promise<Reward[]> => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('points_cost', { ascending: true })
    return (data ?? []) as Reward[]
  },
  ['active-rewards'],
  { revalidate: 30, tags: ['rewards'] }
)
