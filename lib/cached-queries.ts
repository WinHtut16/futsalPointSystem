import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import type { Reward } from '@/types'
import type { AppName } from '@/lib/apps'
import { FUTSAL } from '@/lib/points'

const activeRewards = unstable_cache(
  async (app: AppName): Promise<Reward[]> => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('app', app)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('points_cost', { ascending: true })
    return (data ?? []) as Reward[]
  },
  ['active-rewards'],
  { revalidate: 30, tags: ['rewards'] }
)

/**
 * Active rewards of one business (futsal by default). unstable_cache keys on
 * the argument, so each business is cached separately under the same
 * 'rewards' tag - every reward write still clears all three.
 */
export function getActiveRewards(app: AppName = FUTSAL): Promise<Reward[]> {
  return activeRewards(app)
}
