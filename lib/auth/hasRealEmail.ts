export function hasRealEmail(email: string | undefined): boolean {
  if (!email) return false
  return !email.endsWith('@akoatp.com')
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return local[0] + '***@' + domain
}