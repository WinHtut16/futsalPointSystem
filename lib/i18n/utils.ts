import type { Language } from './index'

export function getLocalizedText(
  primary: string,
  localized: string | null | undefined,
  lang: Language
): string {
  return lang === 'my' && localized ? localized : primary
}
