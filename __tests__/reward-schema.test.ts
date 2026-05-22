import { describe, it, expect } from 'vitest'
import { RewardCreateSchema } from '@/lib/schemas'

describe('RewardCreateSchema multilingual', () => {
  it('accepts name_my and description_my', () => {
    const result = RewardCreateSchema.safeParse({
      name: 'Water Bottle',
      name_my: 'ရေဘူး',
      description_my: 'ရေဘူး တစ်ဘူး',
      points_cost: 50,
    })
    expect(result.success).toBe(true)
  })

  it('accepts missing name_my (optional)', () => {
    const result = RewardCreateSchema.safeParse({
      name: 'Water Bottle',
      points_cost: 50,
    })
    expect(result.success).toBe(true)
  })

  it('rejects name_my exceeding 100 chars', () => {
    const result = RewardCreateSchema.safeParse({
      name: 'Water Bottle',
      name_my: 'မ'.repeat(101),
      points_cost: 50,
    })
    expect(result.success).toBe(false)
  })
})
