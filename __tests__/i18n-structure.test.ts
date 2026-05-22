import { describe, it, expect } from 'vitest'
import { en, my } from '@/lib/i18n'

describe('i18n structure', () => {
  it('my has every key that en has', () => {
    const enKeys = Object.keys(en)
    const myKeys = new Set(Object.keys(my))
    const missing = enKeys.filter((k) => !myKeys.has(k))
    expect(missing).toEqual([])
  })

  it('my has no extra keys', () => {
    const myKeys = Object.keys(my)
    const enKeys = new Set(Object.keys(en))
    const extra = myKeys.filter((k) => !enKeys.has(k))
    expect(extra).toEqual([])
  })
})
