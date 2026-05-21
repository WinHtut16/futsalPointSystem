export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
