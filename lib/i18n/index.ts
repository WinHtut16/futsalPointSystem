import { authEN, authMY } from './namespaces/auth'
import { customerEN, customerMY } from './namespaces/customer'
import { commonEN, commonMY } from './namespaces/common'
import { adminEN, adminMY } from './namespaces/admin'
import { bookingEN, bookingMY } from './namespaces/booking'
import { parkEN, parkMY } from './namespaces/park'

export const en = {
  ...authEN,
  ...customerEN,
  ...commonEN,
  ...adminEN,
  ...bookingEN,
  ...parkEN,
} as const

export const my = {
  ...authMY,
  ...customerMY,
  ...commonMY,
  ...adminMY,
  ...bookingMY,
  ...parkMY,
} satisfies { [K in keyof typeof en]: string }

export type TranslationKey = keyof typeof en
export type Language = 'en' | 'my'
export const languages: Language[] = ['en', 'my']
