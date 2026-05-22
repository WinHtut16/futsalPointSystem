import { authEN, authMY } from './namespaces/auth'
import { customerEN, customerMY } from './namespaces/customer'
import { commonEN, commonMY } from './namespaces/common'
import { adminEN, adminMY } from './namespaces/admin'

export const en = {
  ...authEN,
  ...customerEN,
  ...commonEN,
  ...adminEN,
} as const

export const my = {
  ...authMY,
  ...customerMY,
  ...commonMY,
  ...adminMY,
} satisfies { [K in keyof typeof en]: string }

export type TranslationKey = keyof typeof en
export type Language = 'en' | 'my'
export const languages: Language[] = ['en', 'my']
