import { plexFontVars } from '@/lib/fonts'

// Scoped to (auth)/admin/* only — admin login, forgot-password,
// reset-password. Customer (auth)/login and (auth)/register sit outside
// this folder and keep the site's Sora/Manrope brand untouched.
//
// data-font-scope="admin" repoints --font-display/--font-body to the shared
// Plex admin stack (see globals.css). plexFontVars loads the Plex font files
// themselves — only here, so customer routes never download them.
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return <div data-font-scope="admin" className={plexFontVars}>{children}</div>
}
