import { describe, it, expect } from 'vitest'
import { getLocalizedText } from '@/lib/i18n/utils'

describe('getLocalizedText', () => {
  it('returns localized when lang=my and localized present', () => {
    expect(getLocalizedText('Water', 'ရေဘူး', 'my')).toBe('ရေဘူး')
  })

  it('falls back to primary when lang=my but localized is null', () => {
    expect(getLocalizedText('Water', null, 'my')).toBe('Water')
  })

  it('falls back to primary when lang=my but localized is empty string', () => {
    expect(getLocalizedText('Water', '', 'my')).toBe('Water')
  })

  it('returns primary when lang=en regardless of localized', () => {
    expect(getLocalizedText('Water', 'ရေဘူး', 'en')).toBe('Water')
  })
})
