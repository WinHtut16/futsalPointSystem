# i18n Multilingual Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `translations.ts` flat file with a namespace-split i18n architecture, add full admin panel translations, and extend the `rewards` table with optional Burmese name/description columns for dynamic multilingual reward content.

**Architecture:** Translation keys remain flat (`t('auth.signIn')`) to avoid touching customer components. Source is split into co-located EN+MY namespace files (`lib/i18n/namespaces/*.ts`) merged at `lib/i18n/index.ts`. Dynamic reward text (DB-stored) uses a `getLocalizedText()` utility rather than translation keys, with automatic English fallback when no Burmese value is present.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Zod, Vitest (unit tests)

---

## Scope note

Two independent subsystems are combined here because they ship together:
- **Phase A (Tasks 1–4):** Translation file split + admin translations
- **Phase B (Tasks 5–9):** DB multilingual rewards + form/API/display changes

Both must be implemented for the feature to be complete, but Phase A can be merged and tested independently.

---

## File Map

### Phase A – Translation architecture

| Action | Path |
|--------|------|
| Create | `lib/i18n/namespaces/auth.ts` |
| Create | `lib/i18n/namespaces/customer.ts` |
| Create | `lib/i18n/namespaces/common.ts` |
| Create | `lib/i18n/namespaces/admin.ts` |
| Create | `lib/i18n/index.ts` |
| Modify | `lib/i18n/LanguageContext.tsx` |
| Delete | `lib/i18n/translations.ts` |
| Modify | `components/admin/AdminNav.tsx` |
| Modify | `components/admin/PendingRedemptionsBanner.tsx` |
| Modify | `components/admin/RedemptionRequestCard.tsx` |
| Modify | `components/admin/RewardAdminRow.tsx` |
| Modify | `components/admin/RewardForm.tsx` *(Phase A: labels only; Phase B: adds MY fields)* |

### Phase B – Dynamic multilingual rewards

| Action | Path |
|--------|------|
| Create | `supabase-multilingual-rewards.sql` |
| Create | `lib/i18n/utils.ts` |
| Modify | `types/index.ts` |
| Modify | `lib/schemas.ts` |
| Modify | `app/api/rewards/route.ts` |
| Modify | `app/api/rewards/[id]/route.ts` |
| Modify | `components/admin/RewardForm.tsx` *(Phase B: adds MY input fields)* |
| Modify | `components/admin/RewardAdminRow.tsx` *(Phase B: display MY name when admin lang=my)* |
| Modify | `components/customer/RewardCard.tsx` |

---

## Task 1 – Create auth + customer + common namespace files

**Files:**
- Create: `lib/i18n/namespaces/auth.ts`
- Create: `lib/i18n/namespaces/customer.ts`
- Create: `lib/i18n/namespaces/common.ts`

Each file co-locates EN and MY for that domain so a translator can open one file and see both columns.

- [ ] **Step 1.1 – Create `lib/i18n/namespaces/auth.ts`**

```typescript
export const authEN = {
  'auth.tagline': 'Sign in to your account',
  'auth.phone': 'Phone Number',
  'auth.phonePlaceholder': '09XXXXXXXXX',
  'auth.password': 'Password',
  'auth.passwordPlaceholder': 'Enter password',
  'auth.signIn': 'Sign In',
  'auth.signingIn': 'Signing in...',
  'auth.noAccount': 'No account?',
  'auth.register': 'Register',
  'auth.invalidCredentials': 'Invalid phone number or password.',
  'auth.tooManyAttempts': 'Too many attempts. Please wait a few minutes and try again.',
  'auth.createHeading': 'Create Account',
  'auth.createTagline': 'Join AkoATP Points today',
  'auth.username': 'Username',
  'auth.usernamePlaceholder': 'Your name or nickname',
  'auth.newPasswordPlaceholder': 'Min. 8 characters',
  'auth.createAccount': 'Create Account',
  'auth.creating': 'Creating...',
  'auth.haveAccount': 'Already have an account?',
  'auth.signInLink': 'Sign in',
  'auth.invalidPhone': 'Enter a valid Myanmar phone number (e.g. 09XXXXXXXXX).',
  'auth.passwordTooShort': 'Password must be at least 8 characters.',
  'auth.passwordWeak': 'Password is too weak. Add numbers or uppercase letters.',
  'auth.registrationFailed': 'Registration failed. Please try again.',
  'auth.accountCreated': 'Account created! Please go to the login page to sign in.',
} as const

export const authMY: typeof authEN = {
  'auth.tagline': 'သင့်အကောင့်သို့ ဝင်ရောက်ပါ',
  'auth.phone': 'ဖုန်းနံပါတ်',
  'auth.phonePlaceholder': '09XXXXXXXXX',
  'auth.password': 'စကားဝှက်',
  'auth.passwordPlaceholder': 'စကားဝှက် ထည့်ပါ',
  'auth.signIn': 'ဝင်ရောက်ရန်',
  'auth.signingIn': 'ဝင်ရောက်နေသည်...',
  'auth.noAccount': 'အကောင့်မရှိဘူးလား?',
  'auth.register': 'မှတ်ပုံတင်ရန်',
  'auth.invalidCredentials': 'ဖုန်းနံပါတ် သို့မဟုတ် စကားဝှက် မှားနေသည်။',
  'auth.tooManyAttempts': 'ကြိမ်ရေပိုများနေသည်။ မိနစ်အနည်းငယ်စောင့်၍ ထပ်ကြိုးစားပါ။',
  'auth.createHeading': 'အကောင့်ဖွင့်ရန်',
  'auth.createTagline': 'AkoATP Points တွင် ယနေ့ ပါဝင်ပါ',
  'auth.username': 'အမည်',
  'auth.usernamePlaceholder': 'သင့်နာမည် သို့မဟုတ် အမည်ပြောင်',
  'auth.newPasswordPlaceholder': 'အနည်းဆုံး ၈ လုံးရိုက်နှိပ်ပါ',
  'auth.createAccount': 'အကောင့်ဖွင့်ရန်',
  'auth.creating': 'ဖွင့်နေသည်...',
  'auth.haveAccount': 'အကောင့်ရှိပြီးသားလား?',
  'auth.signInLink': 'ဝင်ရောက်ရန်',
  'auth.invalidPhone': 'မြန်မာဖုန်းနံပါတ် မှန်ကန်သောပုံစံ ထည့်ပါ (ဥပမာ 09XXXXXXXXX)။',
  'auth.passwordTooShort': 'စကားဝှက် အနည်းဆုံး ၈ လုံး ဖြစ်ရမည်။',
  'auth.passwordWeak': 'စကားဝှက် အားနည်းနေသည်။ ဂဏန်းများ သို့မဟုတ် စာလုံးကြီးများ ထည့်ပါ။',
  'auth.registrationFailed': 'မှတ်ပုံတင်ခြင်း မအောင်မြင်ပါ။ ထပ်ကြိုးစားပါ။',
  'auth.accountCreated': 'အကောင့်ဖွင့်ပြီးပါပြီ! ဝင်ရောက်ရန် စာမျက်နှာသို့ သွားပါ။',
}
```

- [ ] **Step 1.2 – Create `lib/i18n/namespaces/customer.ts`**

```typescript
export const customerEN = {
  // Navigation
  'nav.home': 'Home',
  'nav.history': 'History',
  'nav.rewards': 'Rewards',
  'nav.logout': 'Logout',
  // Points card
  'card.yourPoints': 'Your Points',
  // Dashboard
  'dashboard.recentActivity': 'Recent Activity',
  'dashboard.viewAll': 'View all',
  'dashboard.noActivity': 'No activity yet. Start playing to earn points!',
  'dashboard.spendPoints': 'Ready to spend your points?',
  'dashboard.viewRewards': '🎁 View Rewards',
  // History
  'history.title': 'Point History',
  'history.pendingRequests': 'Pending Requests',
  'history.pendingApproval': 'Pending approval',
  'history.cancel': 'Cancel',
  'history.noTransactions': 'No transactions yet.',
  'history.previous': 'Previous',
  'history.next': 'Next',
  'history.pageOf': 'Page {page} of {total}',
  'history.approved': 'Approved! Your points have been deducted.',
  'history.rejected': 'Rejected. Your request was declined.',
  // Transactions
  'tx.played': 'Played',
  'tx.redemption': 'Redemption',
  // Rewards
  'rewards.title': 'Rewards',
  'rewards.left': 'left',
  'rewards.pts': 'pts',
  'rewards.request': 'Request',
  'rewards.outOfStock': 'Out of stock',
  'rewards.notEnoughPts': 'Not enough pts',
  'rewards.pending': 'Pending...',
  'rewards.cancel': 'Cancel',
  'rewards.keep': 'Keep',
  'rewards.requestRedemption': 'Request Redemption',
  'rewards.sendRequest': 'Send Request',
  'rewards.cancelRequest': 'Cancel Request',
  'rewards.adminApproveNote': 'Your points will only be deducted when an admin approves your request at the counter.',
  'rewards.pointsNotDeducted': 'Your points have not been deducted.',
  'rewards.noRewards': 'No rewards available yet.',
  'rewards.checkBack': 'Check back soon!',
  'rewards.remainingAfter': 'Remaining after:',
} as const

export const customerMY: typeof customerEN = {
  'nav.home': 'ပင်မစာမျက်နှာ',
  'nav.history': 'မှတ်တမ်း',
  'nav.rewards': 'ဆုလာဘ်',
  'nav.logout': 'ထွက်ရန်',
  'card.yourPoints': 'သင့်လက်ရှိ ပွိုင့်များ',
  'dashboard.recentActivity': 'မကြာသေးမှီ လှုပ်ရှားမှုများ',
  'dashboard.viewAll': 'အားလုံးကြည့်ရန်',
  'dashboard.noActivity': 'မှတ်တမ်းမရှိသေးပါ။ ကစားပြီး ပွိုင့်များ ရယူပါ!',
  'dashboard.spendPoints': 'ပွိုင့်များ သုံးရန် အဆင်သင့်ဖြစ်ပြီလား?',
  'dashboard.viewRewards': '🎁 ဆုလာဘ်များ ကြည့်ရန်',
  'history.title': 'ပွိုင့်မှတ်တမ်း',
  'history.pendingRequests': 'ဆောင်ရွက်ဆဲ တောင်းဆိုမှုများ',
  'history.pendingApproval': 'အတည်ပြုချက် စောင့်ဆိုင်းနေသည်',
  'history.cancel': 'ပယ်ဖျက်ရန်',
  'history.noTransactions': 'မှတ်တမ်းများ မရှိသေးပါ။',
  'history.previous': 'နောက်သို့',
  'history.next': 'ရှေ့သို့',
  'history.pageOf': 'စာမျက်နှာ {page} / {total}',
  'history.approved': 'အတည်ပြုပြီး! သင့်ပွိုင့်များ နုတ်ယူပြီးပါပြီ။',
  'history.rejected': 'ငြင်းပယ်ခံရသည်။ သင့်တောင်းဆိုမှုကို ငြင်းပယ်ခဲ့သည်။',
  'tx.played': 'ကစားခဲ့သည်',
  'tx.redemption': 'ဆုလာဘ်ရယူမှု',
  'rewards.title': 'ဆုလာဘ်များ',
  'rewards.left': 'ကျန်',
  'rewards.pts': 'မှတ်',
  'rewards.request': 'တောင်းဆိုရန်',
  'rewards.outOfStock': 'ပစ္စည်းကုန်နေသည်',
  'rewards.notEnoughPts': 'အမှတ်မလုံလောက်ပါ',
  'rewards.pending': 'စောင့်ဆိုင်းနေသည်...',
  'rewards.cancel': 'ပယ်ဖျက်ရန်',
  'rewards.keep': 'ဆက်ထားရန်',
  'rewards.requestRedemption': 'ဆုလာဘ် တောင်းဆိုရန်',
  'rewards.sendRequest': 'တောင်းဆိုမှု ပို့ရန်',
  'rewards.cancelRequest': 'တောင်းဆိုမှု ပယ်ဖျက်ရန်',
  'rewards.adminApproveNote': 'ကောင်တာတွင် ဝန်ထမ်းမှ အတည်ပြုမှသာ သင့်ပွိုင့်များ နုတ်ယူမည်ဖြစ်သည်။',
  'rewards.pointsNotDeducted': 'သင့်ပွိုင့်များ မနုတ်ယူရသေးပါ။',
  'rewards.noRewards': 'ဆုလာဘ်များ မရှိသေးပါ။',
  'rewards.checkBack': 'နောက်မှ ထပ်စစ်ဆေးပါ!',
  'rewards.remainingAfter': 'ကျန်မည့်ပွိုင့်:',
}
```

- [ ] **Step 1.3 – Create `lib/i18n/namespaces/common.ts`**

```typescript
export const commonEN = {
  'common.loading': 'Loading...',
  'common.error': 'Something went wrong.',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.back': 'Back',
  'common.logout': 'Logout',
  'common.pts': 'pts',
  'common.optional': 'optional',
} as const

export const commonMY: typeof commonEN = {
  'common.loading': 'ခဏစောင့်ပါ...',
  'common.error': 'တစ်ခုခု မှားနေသည်။',
  'common.save': 'သိမ်းဆည်းရန်',
  'common.cancel': 'ပယ်ဖျက်ရန်',
  'common.delete': 'ဖျက်ရန်',
  'common.edit': 'ပြင်ရန်',
  'common.back': 'နောက်သို့',
  'common.logout': 'ထွက်ရန်',
  'common.pts': 'မှတ်',
  'common.optional': 'ရွေးချယ်နိုင်သည်',
}
```

- [ ] **Step 1.4 – Commit**

```bash
git add lib/i18n/namespaces/
git commit -m "feat(i18n): add namespace source files for auth, customer, common"
```

---

## Task 2 – Create admin namespace translations

**Files:**
- Create: `lib/i18n/namespaces/admin.ts`

All current admin components hardcode English. This task defines keys; wiring to components happens in Task 4.

- [ ] **Step 2.1 – Create `lib/i18n/namespaces/admin.ts`**

```typescript
export const adminEN = {
  // Navigation
  'admin.navDashboard': 'Dashboard',
  'admin.navCustomers': 'Customers',
  'admin.navRequests': 'Requests',
  'admin.navRewards': 'Rewards',
  'admin.navStaff': 'Staff',
  'admin.logout': 'Logout',

  // Pending redemptions banner
  'admin.pendingRedemptions': 'Pending Redemptions',
  'admin.tapToReview': 'Tap to review and approve at the counter',

  // Redemption request card
  'admin.ptsAvailable': 'pts available',
  'admin.approve': 'Approve',
  'admin.reject': 'Reject',

  // Reward admin row
  'admin.active': 'Active',
  'admin.inactive': 'Inactive',
  'admin.inStock': 'in stock',
  'admin.activate': 'Activate',
  'admin.deactivate': 'Deactivate',
  'admin.deleteReward': 'Delete',
  'admin.confirmDelete': 'Delete "{name}"? This cannot be undone.',

  // Reward form (create/edit)
  'admin.rewardNameLabel': 'Reward Name (English)',
  'admin.rewardNamePlaceholder': 'e.g. 1 Bottle Water, 1 Hr Free Play',
  'admin.rewardNameMYLabel': 'Reward Name (Burmese, optional)',
  'admin.rewardNameMYPlaceholder': 'မြန်မာဘာသာ',
  'admin.rewardDescLabel': 'Description (optional)',
  'admin.rewardDescPlaceholder': 'Additional details',
  'admin.rewardDescMYLabel': 'Description in Burmese (optional)',
  'admin.rewardDescMYPlaceholder': 'မြန်မာဘာသာ အသေးစိတ်',
  'admin.rewardPointsLabel': 'Points Required',
  'admin.rewardPointsPlaceholder': 'e.g. 50',
  'admin.rewardStockLabel': 'Stock (leave blank for unlimited)',
  'admin.rewardStockPlaceholder': 'e.g. 10',
  'admin.createReward': 'Create Reward',
  'admin.rewardValidationError': 'Name and a positive points cost are required.',
} as const

export const adminMY: typeof adminEN = {
  'admin.navDashboard': 'ဒက်ရှ်ဘုတ်',
  'admin.navCustomers': 'ဖောက်သည်များ',
  'admin.navRequests': 'တောင်းဆိုမှုများ',
  'admin.navRewards': 'ဆုလာဘ်များ',
  'admin.navStaff': 'ဝန်ထမ်းများ',
  'admin.logout': 'ထွက်ရန်',
  'admin.pendingRedemptions': 'ဆောင်ရွက်ဆဲ ဆုလာဘ်တောင်းဆိုမှုများ',
  'admin.tapToReview': 'ကောင်တာတွင် စစ်ဆေးအတည်ပြုရန် တို့ပါ',
  'admin.ptsAvailable': 'မှတ် ရှိသည်',
  'admin.approve': 'အတည်ပြုရန်',
  'admin.reject': 'ငြင်းပယ်ရန်',
  'admin.active': 'အသုံးပြုနေသည်',
  'admin.inactive': 'ရပ်ဆိုင်းထားသည်',
  'admin.inStock': 'ကျန်',
  'admin.activate': 'ဖွင့်ရန်',
  'admin.deactivate': 'ပိတ်ရန်',
  'admin.deleteReward': 'ဖျက်ရန်',
  'admin.confirmDelete': '"{name}" ဖျက်မည်လား? ပြန်မရနိုင်ပါ။',
  'admin.rewardNameLabel': 'ဆုလာဘ်နာမည် (အင်္ဂလိပ်)',
  'admin.rewardNamePlaceholder': 'e.g. 1 Bottle Water, 1 Hr Free Play',
  'admin.rewardNameMYLabel': 'ဆုလာဘ်နာမည် (မြန်မာ၊ ရွေးချယ်နိုင်)',
  'admin.rewardNameMYPlaceholder': 'မြန်မာဘာသာ',
  'admin.rewardDescLabel': 'အသေးစိတ် (ရွေးချယ်နိုင်)',
  'admin.rewardDescPlaceholder': 'နောက်ထပ် အချက်အလက်များ',
  'admin.rewardDescMYLabel': 'မြန်မာဘာသာ အသေးစိတ် (ရွေးချယ်နိုင်)',
  'admin.rewardDescMYPlaceholder': 'မြန်မာဘာသာ အသေးစိတ်',
  'admin.rewardPointsLabel': 'လိုအပ်သော ပွိုင့်',
  'admin.rewardPointsPlaceholder': 'e.g. 50',
  'admin.rewardStockLabel': 'စတော့ (ထားခဲ့ပါက အကန့်အသတ်မရှိ)',
  'admin.rewardStockPlaceholder': 'e.g. 10',
  'admin.createReward': 'ဆုလာဘ် ဖန်တီးရန်',
  'admin.rewardValidationError': 'နာမည်နှင့် ပွိုင့် လိုအပ်သည်။',
}
```

- [ ] **Step 2.2 – Commit**

```bash
git add lib/i18n/namespaces/admin.ts
git commit -m "feat(i18n): add admin namespace translations (EN + MY)"
```

---

## Task 3 – Merge namespaces into unified index + update LanguageContext

**Files:**
- Create: `lib/i18n/index.ts`
- Modify: `lib/i18n/LanguageContext.tsx`
- Delete: `lib/i18n/translations.ts`

The merged `en` and `my` objects at `index.ts` are identical in shape to the old `translations.ts` exports. `LanguageContext` only changes its import path. No component changes needed.

- [ ] **Step 3.1 – Write the test first**

Create `__tests__/i18n-structure.test.ts`:

```typescript
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
```

- [ ] **Step 3.2 – Run test to confirm it fails (import cannot resolve yet)**

```bash
npm test -- --reporter=verbose i18n-structure
```

Expected: test file fails to compile — `@/lib/i18n` does not exist yet.

- [ ] **Step 3.3 – Create `lib/i18n/index.ts`**

```typescript
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

export const my: typeof en = {
  ...authMY,
  ...customerMY,
  ...commonMY,
  ...adminMY,
}

export type TranslationKey = keyof typeof en
export type Language = 'en' | 'my'
export const languages: Language[] = ['en', 'my']
```

- [ ] **Step 3.4 – Run test to confirm it passes**

```bash
npm test -- --reporter=verbose i18n-structure
```

Expected: PASS – both key-parity assertions green.

- [ ] **Step 3.5 – Update `lib/i18n/LanguageContext.tsx` import**

Replace the import line:

```diff
- import { en, my, type Language, type TranslationKey } from './translations'
+ import { en, my, type Language, type TranslationKey } from './index'
```

No other changes to this file.

- [ ] **Step 3.6 – Delete `lib/i18n/translations.ts`**

```bash
git rm lib/i18n/translations.ts
```

- [ ] **Step 3.7 – Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all 158 tests pass. Fix any import errors before continuing.

- [ ] **Step 3.8 – Commit**

```bash
git add lib/i18n/ __tests__/i18n-structure.test.ts
git commit -m "feat(i18n): split translations into namespace files, add key-parity tests"
```

---

## Task 4 – Wire admin components to useLanguage()

**Files:**
- Modify: `components/admin/AdminNav.tsx`
- Modify: `components/admin/PendingRedemptionsBanner.tsx`
- Modify: `components/admin/RedemptionRequestCard.tsx`
- Modify: `components/admin/RewardAdminRow.tsx`
- Modify: `components/admin/RewardForm.tsx` *(labels only; MY input fields added in Task 7)*

All these components currently use hardcoded English strings. We add `'use client'` where missing and call `useLanguage()`.

- [ ] **Step 4.1 – Update `components/admin/AdminNav.tsx`**

The links array cannot be built from `t()` inside a module-level constant — move label resolution inside the component:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props { role: UserRole }

export default function AdminNav({ role }: Props) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const baseLinks = [
    { href: '/admin/dashboard', label: t('admin.navDashboard') },
    { href: '/admin/customers', label: t('admin.navCustomers') },
    { href: '/admin/redemptions', label: t('admin.navRequests') },
    { href: '/admin/rewards', label: t('admin.navRewards') },
  ]
  const superadminLinks = [{ href: '/admin/staff', label: t('admin.navStaff') }]
  const links = role === 'superadmin' ? [...baseLinks, ...superadminLinks] : baseLinks

  return (
    <nav className="bg-gray-800 text-sm flex">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'flex-1 text-center py-2.5 font-medium transition-colors',
            pathname.startsWith(link.href)
              ? 'text-white border-b-2 border-brand-400'
              : 'text-gray-400 hover:text-white'
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4.2 – Update `components/admin/PendingRedemptionsBanner.tsx`**

Add `useLanguage()` and replace hardcoded strings:

```diff
+ import { useLanguage } from '@/lib/i18n/LanguageContext'

  export default function PendingRedemptionsBanner({ initialCount }: { initialCount: number }) {
    const [count, setCount] = useState(initialCount)
+   const { t } = useLanguage()
    // ... existing useEffect unchanged ...

    return (
      <Link href="/admin/redemptions">
        <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <div>
-           <p className="font-semibold text-yellow-800 text-sm">Pending Redemptions</p>
-           <p className="text-xs text-yellow-600">Tap to review and approve at the counter</p>
+           <p className="font-semibold text-yellow-800 text-sm">{t('admin.pendingRedemptions')}</p>
+           <p className="text-xs text-yellow-600">{t('admin.tapToReview')}</p>
          </div>
          <span className="bg-yellow-400 text-yellow-900 font-bold text-sm px-2.5 py-0.5 rounded-full">
            {count}
          </span>
        </div>
      </Link>
    )
  }
```

- [ ] **Step 4.3 – Update `components/admin/RedemptionRequestCard.tsx`**

```diff
+ import { useLanguage } from '@/lib/i18n/LanguageContext'

  export default function RedemptionRequestCard({ request, onResolved }) {
    const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
    const [error, setError] = useState('')
+   const { t } = useLanguage()
    // ... handleAction unchanged ...

    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{request.customer?.username}</p>
            <p className="text-xs text-gray-500">{request.customer?.phone}</p>
            <p className="text-xs text-gray-400 mt-0.5">
-             {request.customer?.total_points?.toLocaleString()} pts available
+             {request.customer?.total_points?.toLocaleString()} {t('admin.ptsAvailable')}
            </p>
          </div>
          {/* right side unchanged */}
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" size="sm" className="flex-1"
            loading={loading === 'reject'} disabled={!!loading}
            onClick={() => handleAction('reject')}>
-           Reject
+           {t('admin.reject')}
          </Button>
          <Button size="sm" className="flex-1"
            loading={loading === 'approve'} disabled={!!loading}
            onClick={() => handleAction('approve')}>
-           Approve
+           {t('admin.approve')}
          </Button>
        </div>
      </Card>
    )
  }
```

- [ ] **Step 4.4 – Update `components/admin/RewardAdminRow.tsx`**

```diff
+ import { useLanguage } from '@/lib/i18n/LanguageContext'

  export default function RewardAdminRow({ reward, canManage }: RewardAdminRowProps) {
    const router = useRouter()
    const [toggling, setToggling] = useState(false)
    const [deleting, setDeleting] = useState(false)
+   const { t } = useLanguage()

    async function handleDelete() {
-     if (!confirm(`Delete "${reward.name}"? This cannot be undone.`)) return
+     if (!confirm(t('admin.confirmDelete').replace('{name}', reward.name))) return
      // ... rest unchanged
    }

    return (
      <div className="flex items-start justify-between px-4 py-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{reward.name}</p>
            <Badge variant={reward.is_active ? 'green' : 'gray'}>
-             {reward.is_active ? 'Active' : 'Inactive'}
+             {reward.is_active ? t('admin.active') : t('admin.inactive')}
            </Badge>
          </div>
-         <p className="text-xs text-brand-600 font-semibold mt-0.5">{reward.points_cost} pts</p>
+         <p className="text-xs text-brand-600 font-semibold mt-0.5">{reward.points_cost} {t('common.pts')}</p>
          {reward.description && <p className="text-xs text-gray-400 truncate">{reward.description}</p>}
-         {reward.stock !== null && <p className="text-xs text-gray-400">{reward.stock} in stock</p>}
+         {reward.stock !== null && <p className="text-xs text-gray-400">{reward.stock} {t('admin.inStock')}</p>}
        </div>
        {canManage && (
          <div className="flex gap-1.5 shrink-0">
            <Button variant="secondary" size="sm" loading={toggling} onClick={toggleActive}>
-             {reward.is_active ? 'Deactivate' : 'Activate'}
+             {reward.is_active ? t('admin.deactivate') : t('admin.activate')}
            </Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
-             Delete
+             {t('admin.deleteReward')}
            </Button>
          </div>
        )}
      </div>
    )
  }
```

- [ ] **Step 4.5 – Update `components/admin/RewardForm.tsx` (labels only)**

```diff
+ import { useLanguage } from '@/lib/i18n/LanguageContext'

  export default function RewardForm() {
    const router = useRouter()
+   const { t } = useLanguage()
    // ... state unchanged ...

    return (
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="name"
-           label="Reward Name"
-           placeholder="e.g. 1 Bottle Water, 1 Hr Free Play"
+           label={t('admin.rewardNameLabel')}
+           placeholder={t('admin.rewardNamePlaceholder')}
            value={form.name} onChange={set('name')} required maxLength={100} />
          <Input id="description"
-           label="Description (optional)"
-           placeholder="Additional details"
+           label={t('admin.rewardDescLabel')}
+           placeholder={t('admin.rewardDescPlaceholder')}
            value={form.description} onChange={set('description')} maxLength={200} />
          <Input id="points_cost"
-           label="Points Required"
+           label={t('admin.rewardPointsLabel')}
            type="number" min="1"
-           placeholder="e.g. 50"
+           placeholder={t('admin.rewardPointsPlaceholder')}
            value={form.points_cost} onChange={set('points_cost')} required />
          <Input id="stock"
-           label="Stock (leave blank for unlimited)"
+           label={t('admin.rewardStockLabel')}
            type="number" min="0"
-           placeholder="e.g. 10"
+           placeholder={t('admin.rewardStockPlaceholder')}
            value={form.stock} onChange={set('stock')} />
-         {error && <p className="text-sm text-red-500">{error}</p>}
+         {error && <p className="text-sm text-red-500">{t('admin.rewardValidationError')}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" size="md" className="flex-1"
              onClick={() => router.back()}>
-             Cancel
+             {t('common.cancel')}
            </Button>
            <Button type="submit" size="md" loading={loading} className="flex-1">
-             Create Reward
+             {t('admin.createReward')}
            </Button>
          </div>
        </form>
      </Card>
    )
  }
```

- [ ] **Step 4.6 – Run full test suite**

```bash
npm test
```

Expected: 158+ tests pass (new i18n-structure test included).

- [ ] **Step 4.7 – Commit (Phase A complete)**

```bash
git add components/admin/
git commit -m "feat(i18n): wire admin components to useLanguage, eliminate hardcoded strings"
```

---

## Task 5 – Database migration for multilingual rewards

**Files:**
- Create: `supabase-multilingual-rewards.sql`

This adds two nullable columns to `rewards`. Existing rows get NULL, which triggers English fallback in the frontend. No data migration needed.

- [ ] **Step 5.1 – Create `supabase-multilingual-rewards.sql`**

```sql
-- Add optional Burmese columns to rewards.
-- Existing rows keep NULL → frontend falls back to the English name/description.
ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS name_my    TEXT     CHECK (char_length(name_my)    <= 100),
  ADD COLUMN IF NOT EXISTS description_my TEXT  CHECK (char_length(description_my) <= 1000);

COMMENT ON COLUMN rewards.name_my         IS 'Burmese reward name. NULL = display name (English).';
COMMENT ON COLUMN rewards.description_my  IS 'Burmese description. NULL = display description (English).';
```

- [ ] **Step 5.2 – Run migration in Supabase SQL editor**

Paste and run `supabase-multilingual-rewards.sql` in the Supabase project SQL editor.

Verify:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'rewards'
  AND column_name IN ('name_my', 'description_my');
```

Expected: two rows, `character varying`, `YES`.

- [ ] **Step 5.3 – Commit**

```bash
git add supabase-multilingual-rewards.sql
git commit -m "feat(i18n): add name_my + description_my migration for multilingual rewards"
```

---

## Task 6 – Update TypeScript types and Zod schemas

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/schemas.ts`

- [ ] **Step 6.1 – Write a failing test for the schema changes**

Add to `__tests__/api-validation.test.ts` (or a new `__tests__/reward-schema.test.ts`):

```typescript
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
```

- [ ] **Step 6.2 – Run test to confirm failure**

```bash
npm test -- reward-schema
```

Expected: FAIL — `name_my` not yet in schema (strict mode strips it).

- [ ] **Step 6.3 – Update `types/index.ts`**

```diff
  export interface Reward {
    id: string
    name: string
    description: string | null
+   name_my: string | null
+   description_my: string | null
    points_cost: number
    stock: number | null
    is_active: boolean
    created_at: string
    updated_at: string
  }
```

- [ ] **Step 6.4 – Update `lib/schemas.ts`**

```diff
  export const RewardCreateSchema = z.object({
    name: safeText(100).min(1, 'Name is required.'),
+   name_my: safeText(100).nullish(),
    description: safeText(1000).nullish(),
+   description_my: safeText(1000).nullish(),
    points_cost: pointsAmount,
    stock: stockAmount.nullish(),
  })

  export const RewardUpdateSchema = z
    .object({
      name: safeText(100).min(1).optional(),
+     name_my: safeText(100).nullish(),
      description: safeText(1000).nullish(),
+     description_my: safeText(1000).nullish(),
      points_cost: pointsAmount.optional(),
      stock: stockAmount.nullish(),
      is_active: z.boolean({ message: 'is_active must be a boolean.' }).optional(),
    })
    .strict()
    .refine(/* unchanged */)
```

- [ ] **Step 6.5 – Run tests**

```bash
npm test
```

Expected: all tests pass including the new reward-schema tests.

- [ ] **Step 6.6 – Commit**

```bash
git add types/index.ts lib/schemas.ts __tests__/reward-schema.test.ts
git commit -m "feat(i18n): add name_my + description_my to Reward type and Zod schemas"
```

---

## Task 7 – Update reward API routes to pass through new columns

**Files:**
- Modify: `app/api/rewards/route.ts`
- Modify: `app/api/rewards/[id]/route.ts`

The routes currently destructure `{ name, description, points_cost, stock }` from the parsed body. The new columns need to be included in inserts/updates.

- [ ] **Step 7.1 – Update `app/api/rewards/route.ts` POST handler**

```diff
  export async function POST(request: NextRequest) {
    try {
      await requireSuperAdmin()

      const parsed = RewardCreateSchema.safeParse(await parseJson(request))
      if (!parsed.success) return badRequest(parsed.error)
-     const { name, description, points_cost, stock } = parsed.data
+     const { name, name_my, description, description_my, points_cost, stock } = parsed.data

      const supabase = await createServiceClient()
      const { data, error } = await supabase
        .from('rewards')
        .insert({
          name,
+         name_my: name_my ?? null,
          description: description ?? null,
+         description_my: description_my ?? null,
          points_cost,
          stock: stock ?? null,
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data, { status: 201 })
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
```

- [ ] **Step 7.2 – Update `app/api/rewards/[id]/route.ts` PUT handler**

The PUT handler already spreads `parsed.data` directly into `updates`. Because `RewardUpdateSchema` now includes `name_my` and `description_my`, the spread will automatically include them. No structural change needed — but verify the `refine` check still passes when only `name_my` changes:

```typescript
// Verify the refine condition covers the new fields:
// .refine((o) => Object.keys(o).some((k) => (o as Record<string, unknown>)[k] !== undefined))
// name_my: null → undefined after nullish() coercion, so a lone name_my: null won't pass.
// name_my: 'value' → defined, passes. This is correct behaviour.
```

No code change required for `[id]/route.ts`.

- [ ] **Step 7.3 – Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7.4 – Commit**

```bash
git add app/api/rewards/
git commit -m "feat(i18n): pass name_my + description_my through rewards API"
```

---

## Task 8 – Create `getLocalizedText` utility + update customer RewardCard

**Files:**
- Create: `lib/i18n/utils.ts`
- Modify: `components/customer/RewardCard.tsx`

- [ ] **Step 8.1 – Write a failing test for the utility**

Create `__tests__/i18n-utils.test.ts`:

```typescript
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
```

- [ ] **Step 8.2 – Run test to confirm failure**

```bash
npm test -- i18n-utils
```

Expected: FAIL — `@/lib/i18n/utils` does not exist.

- [ ] **Step 8.3 – Create `lib/i18n/utils.ts`**

```typescript
import type { Language } from './index'

export function getLocalizedText(
  primary: string,
  localized: string | null | undefined,
  lang: Language
): string {
  return lang === 'my' && localized ? localized : primary
}
```

- [ ] **Step 8.4 – Run tests to confirm passing**

```bash
npm test -- i18n-utils
```

Expected: 4 tests PASS.

- [ ] **Step 8.5 – Update `components/customer/RewardCard.tsx`**

Import the utility and use it to derive display strings. No change to the card's JSX structure.

```diff
  import { useLanguage } from '@/lib/i18n/LanguageContext'
+ import { getLocalizedText } from '@/lib/i18n/utils'

  export default function RewardCard({ reward, userPoints, pendingRequestId, onRequested, onCancelled }: RewardCardProps) {
    const { t, lang } = useLanguage()
+   const displayName = getLocalizedText(reward.name, reward.name_my, lang)
+   const displayDesc = reward.description
+     ? getLocalizedText(reward.description, reward.description_my, lang)
+     : null
    // ... existing state unchanged ...

    return (
      <>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          <div>
-           <p className="font-semibold text-gray-900">{reward.name}</p>
-           {reward.description && (
-             <p className="text-xs text-gray-500 mt-0.5">{reward.description}</p>
+           <p className="font-semibold text-gray-900">{displayName}</p>
+           {displayDesc && (
+             <p className="text-xs text-gray-500 mt-0.5">{displayDesc}</p>
            )}
            {/* rest unchanged */}
          </div>
          {/* rest unchanged */}
        </div>

        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('rewards.requestRedemption')}>
          <div className="space-y-4">
            <p className="text-gray-700 text-sm">
              {t('rewards.requestRedemption')} <strong>{displayName}</strong>{' '}
              <strong className="text-brand-600">{reward.points_cost} {t('rewards.pts')}</strong>?
            </p>
            {/* rest unchanged */}
          </div>
        </Modal>

        <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('rewards.cancelRequest')}>
          <div className="space-y-4">
            <p className="text-gray-700 text-sm">
              {t('rewards.cancelRequest')} <strong>{displayName}</strong>?
            </p>
            {/* rest unchanged */}
          </div>
        </Modal>
      </>
    )
  }
```

Note: `lang` must be destructured from `useLanguage()` — it is already available from the existing `LanguageContextValue` interface.

- [ ] **Step 8.6 – Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8.7 – Commit**

```bash
git add lib/i18n/utils.ts __tests__/i18n-utils.test.ts components/customer/RewardCard.tsx
git commit -m "feat(i18n): getLocalizedText utility + RewardCard shows Burmese name/desc"
```

---

## Task 9 – Update RewardForm with Burmese input fields + RewardAdminRow display

**Files:**
- Modify: `components/admin/RewardForm.tsx`
- Modify: `components/admin/RewardAdminRow.tsx`

- [ ] **Step 9.1 – Update `components/admin/RewardForm.tsx` form state and fields**

Add `name_my` and `description_my` to the form state and submit payload:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function RewardForm() {
  const router = useRouter()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    name_my: '',
    description: '',
    description_my: '',
    points_cost: '',
    stock: '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cost = parseInt(form.points_cost)
    if (!form.name.trim() || cost <= 0) {
      setError(t('admin.rewardValidationError'))
      return
    }

    setLoading(true)
    const res = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        name_my: form.name_my.trim() || null,
        description: form.description.trim() || null,
        description_my: form.description_my.trim() || null,
        points_cost: cost,
        stock: form.stock ? parseInt(form.stock) : null,
      }),
    })
    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? t('admin.rewardValidationError'))
      return
    }

    router.push('/admin/rewards')
    router.refresh()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input id="name"
          label={t('admin.rewardNameLabel')}
          placeholder={t('admin.rewardNamePlaceholder')}
          value={form.name} onChange={set('name')} required maxLength={100} />
        <Input id="name_my"
          label={t('admin.rewardNameMYLabel')}
          placeholder={t('admin.rewardNameMYPlaceholder')}
          value={form.name_my} onChange={set('name_my')} maxLength={100} />
        <Input id="description"
          label={t('admin.rewardDescLabel')}
          placeholder={t('admin.rewardDescPlaceholder')}
          value={form.description} onChange={set('description')} maxLength={1000} />
        <Input id="description_my"
          label={t('admin.rewardDescMYLabel')}
          placeholder={t('admin.rewardDescMYPlaceholder')}
          value={form.description_my} onChange={set('description_my')} maxLength={1000} />
        <Input id="points_cost"
          label={t('admin.rewardPointsLabel')}
          type="number" min="1"
          placeholder={t('admin.rewardPointsPlaceholder')}
          value={form.points_cost} onChange={set('points_cost')} required />
        <Input id="stock"
          label={t('admin.rewardStockLabel')}
          type="number" min="0"
          placeholder={t('admin.rewardStockPlaceholder')}
          value={form.stock} onChange={set('stock')} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" size="md" className="flex-1"
            onClick={() => router.back()}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="md" loading={loading} className="flex-1">
            {t('admin.createReward')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
```

- [ ] **Step 9.2 – Update `components/admin/RewardAdminRow.tsx` to show Burmese name in admin panel when lang=my**

```diff
  import { useLanguage } from '@/lib/i18n/LanguageContext'
+ import { getLocalizedText } from '@/lib/i18n/utils'

  export default function RewardAdminRow({ reward, canManage }: RewardAdminRowProps) {
    // ...
-   const { t } = useLanguage()
+   const { t, lang } = useLanguage()
+   const displayName = getLocalizedText(reward.name, reward.name_my, lang)

    return (
      <div className="flex items-start justify-between px-4 py-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
-           <p className="text-sm font-medium text-gray-900 truncate">{reward.name}</p>
+           <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
```

- [ ] **Step 9.3 – Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 9.4 – Commit (Phase B complete)**

```bash
git add components/admin/RewardForm.tsx components/admin/RewardAdminRow.tsx
git commit -m "feat(i18n): RewardForm bilingual inputs, admin row shows localized reward name"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|-------------|------|
| Split translation files | Task 1–3 |
| Type safety / key parity | Task 3 (i18n-structure test) |
| Translation helper / fallback | Task 8 (`getLocalizedText`) |
| Language persistence (localStorage) | Unchanged — existing LanguageContext already handles this |
| Customer page translations | Preserved verbatim in Task 1 namespace files |
| Admin page translations | Task 2 + Task 4 |
| Dynamic multilingual rewards (DB) | Task 5 |
| Updated TypeScript types | Task 6 |
| Updated Zod schemas | Task 6 |
| Admin CRUD form bilingual | Task 9 |
| API routes updated | Task 7 |
| Customer RewardCard fallback | Task 8 |
| No hydration mismatch | Preserved — LanguageContext reads localStorage in useEffect |
| SSR / App Router compatible | All changes are client-component scoped |
| Future language support | Add new namespace file + extend `en`/`my` in index.ts |

### Known gaps (out of scope per constraints)

- Staff management forms (`CreateAdminForm`, `StaffResetPasswordForm`, `DeleteStaffButton`) still use hardcoded English — adding keys follows the same Task 4 pattern when needed.
- Customer management pages (`CustomerSearch`, `AddPointsForm`, `DeleteCustomerButton`) same.
- These are left out per "lightweight, avoid overengineering" constraint. The architecture supports adding them incrementally.

---

## Migration order (for manual execution)

1. Run Task 1–3 (translation split) — safe, no functional change
2. Run Task 4 (admin components) — safe, UI strings only
3. **Run Task 5 SQL migration in Supabase first**, then Tasks 6–9
4. Task 5 must precede Tasks 6–9 — the DB columns must exist before frontend/API changes ship
