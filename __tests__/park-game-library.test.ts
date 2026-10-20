import { describe, it, expect } from 'vitest'
import type { ShelfTitle } from '@/lib/park/game-board'
import { buildRows, descriptionFor, filterTitles, pickFeatured } from '@/lib/park/game-library'

let n = 0
const g = (over: Partial<ShelfTitle> = {}): ShelfTitle => ({
  id: `g${++n}`,
  title: `Game ${n}`,
  platforms: ['PS5'],
  genre: 'action',
  maxPlayers: 1,
  coverUrl: null,
  isNew: false,
  isPopular: false,
  descriptionEn: null,
  descriptionMy: null,
  localCoop: false,
  online: false,
  featured: false,
  ...over,
})

describe('buildRows', () => {
  it('drops rows with fewer than 3 games and keeps display order', () => {
    const list = [g({ isNew: true }), g({ isNew: true }), g({ isNew: true }), g({ genre: 'sports' }), g({ platforms: ['PS4'] })]
    // new: 3 / ps5: 4 / action: 4 (incl. the PS4 one) / sports: 1 / ps4: 1
    expect(buildRows(list).map((r) => r.key)).toEqual(['new', 'ps5', 'action'])
  })

  it('puts a game in every row it fits', () => {
    const list = [1, 2, 3].map(() => g({ platforms: ['PS4', 'PS5'], localCoop: true }))
    const keys = buildRows(list).map((r) => r.key)
    expect(keys).toEqual(expect.arrayContaining(['coop', 'ps5', 'ps4']))
  })
})

describe('buildRows on a long list', () => {
  it('drops rows that hold most of the list and caps at 4 rows', () => {
    const list = Array.from({ length: 12 }, (_, i) =>
      g({ platforms: ['PS5'], isNew: i < 3, localCoop: i < 6, genre: i < 4 ? 'sports' : 'action', online: i < 5 }),
    )
    const keys = buildRows(list).map((r) => r.key)
    expect(keys).not.toContain('ps5') // 12 of 12
    expect(keys.length).toBeLessThanOrEqual(4)
    expect(keys).toEqual((['new', 'coop', 'sports', 'action'] as const).filter((k) => keys.includes(k)))
  })
})

describe('pickFeatured', () => {
  it('prefers Featured, covered first, max 5', () => {
    const a = g({ featured: true })
    const b = g({ featured: true, coverUrl: 'https://res.cloudinary.com/x.jpg' })
    expect(pickFeatured([a, b, g({ isPopular: true })]).map((x) => x.id)).toEqual([b.id, a.id])
  })

  it('falls back to Popular/New, then anything', () => {
    const p = g({ isPopular: true })
    expect(pickFeatured([g(), p])).toEqual([p])
    const plain = Array.from({ length: 7 }, () => g())
    expect(pickFeatured(plain)).toHaveLength(5)
  })
})

describe('filterTitles', () => {
  const fc = g({ title: 'EA Sports FC 26', platforms: ['PS4', 'PS5'], localCoop: true })
  const wukong = g({ title: 'Black Myth: Wukong', platforms: ['PS5'] })
  const list = [fc, wukong]

  it('matches every word, ignoring case and punctuation', () => {
    expect(filterTitles(list, 'myth wukong', 'all')).toEqual([wukong])
    expect(filterTitles(list, 'fc', 'all')).toEqual([fc])
    expect(filterTitles(list, '', 'all')).toEqual(list)
  })

  it('filters by console and co-op', () => {
    expect(filterTitles(list, '', 'PS4')).toEqual([fc])
    expect(filterTitles(list, '', 'coop')).toEqual([fc])
  })
})

describe('descriptionFor', () => {
  it('uses the visitor language, falling back to the other', () => {
    expect(descriptionFor(g({ descriptionEn: 'en', descriptionMy: 'my' }), 'my')).toBe('my')
    expect(descriptionFor(g({ descriptionEn: 'en' }), 'my')).toBe('en')
    expect(descriptionFor(g({ descriptionMy: 'my' }), 'en')).toBe('my')
    expect(descriptionFor(g(), 'en')).toBeNull()
  })
})
