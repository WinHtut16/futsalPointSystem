export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

const MY_DIGITS = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉']

export function toMyDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => MY_DIGITS[+d])
}

const MY_MONTHS: Record<string, string> = {
  January: 'ဇန်နဝါရီ', February: 'ဖေဖော်ဝါရီ',
  March: 'မတ်', April: 'ဧပြီ', May: 'မေ',
  June: 'ဇွန်', July: 'ဇူလိုင်', August: 'သြဂုတ်',
  September: 'စက်တင်ဘာ', October: 'အောက်တိုဘာ',
  November: 'နိုဝင်ဘာ', December: 'ဒီဇင်ဘာ',
}

export function formatDate(dateStr: string, lang?: string): string {
  const date = new Date(dateStr)
  if (lang === 'my') {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Yangon',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(date)
    const day   = parts.find(p => p.type === 'day')?.value ?? ''
    const month = parts.find(p => p.type === 'month')?.value ?? ''
    const year  = parts.find(p => p.type === 'year')?.value ?? ''
    return `${day} ${MY_MONTHS[month] ?? month} ${year}`
  }
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Yangon',
  })
}

export function formatDateTime(dateStr: string, lang?: string): string {
  const date = new Date(dateStr)
  if (lang === 'my') {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Yangon',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date)
    const day    = parts.find(p => p.type === 'day')?.value ?? ''
    const month  = parts.find(p => p.type === 'month')?.value ?? ''
    const year   = parts.find(p => p.type === 'year')?.value ?? ''
    const hour   = parts.find(p => p.type === 'hour')?.value ?? ''
    const minute = parts.find(p => p.type === 'minute')?.value ?? ''
    const ampm   = parts.find(p => p.type === 'dayPeriod')?.value ?? ''
    return `${day} ${MY_MONTHS[month] ?? month} ${year}, ${hour}:${minute} ${ampm}`
  }
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Yangon',
  })
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, '')
}

export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@akoatp.com`
}

export function usernameToAdminEmail(username: string): string {
  return `${username.toLowerCase().trim()}@akoatp-staff.com`
}

export function safeRedirect(next: string | null | undefined, fallback: string = '/'): string {
  if (!next) return fallback
  if (
    next.startsWith('http://') ||
    next.startsWith('https://') ||
    next.startsWith('//') ||
    next.startsWith('\\') ||
    next.includes('\n') ||
    next.includes('\r')
  ) {
    return fallback
  }
  if (!next.startsWith('/')) return fallback
  return next
}
