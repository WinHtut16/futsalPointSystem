import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Booking-system design tokens (map to CSS vars in globals.css).
        // Used by the (site) route group + booking admin pages only.
        primary: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          soft: 'var(--color-primary-soft)',
          on: 'var(--color-on-primary)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          soft: 'var(--color-accent-soft)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt: 'var(--color-surface-alt)',
        },
        ink: {
          DEFAULT: 'var(--color-text)',
          primary: 'var(--color-text-primary)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
        line: {
          DEFAULT: 'var(--color-line)',
          strong: 'var(--color-line-strong)',
        },
        slot: {
          available: 'var(--color-slot-available)',
          'available-bg': 'var(--color-slot-available-bg)',
          pending: 'var(--color-slot-pending)',
          'pending-bg': 'var(--color-slot-pending-bg)',
          booked: 'var(--color-slot-booked)',
          'booked-bg': 'var(--color-slot-booked-bg)',
          closed: 'var(--color-slot-closed)',
          'closed-bg': 'var(--color-slot-closed-bg)',
        },
        holiday: {
          DEFAULT: 'var(--color-holiday)',
          bg: 'var(--color-holiday-bg)',
        },
        price: {
          morning: 'var(--color-price-morning)',
          evening: 'var(--color-price-evening)',
          weekend: 'var(--color-price-weekend)',
        },
      },
      fontFamily: {
        // Distinct keys so Tailwind's default `font-mono` (used by the
        // points system) is NOT overridden.
        display: ['var(--font-sora)', 'var(--font-noto-my)', 'system-ui', 'sans-serif'],
        body: ['var(--font-manrope)', 'var(--font-noto-my)', 'system-ui', 'sans-serif'],
        fbmono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
        my: ['var(--font-noto-my)', 'Myanmar Text', 'Pyidaungsu', 'Padauk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'fb-sm': 'var(--shadow-sm)',
        'fb-md': 'var(--shadow-md)',
        'fb-lg': 'var(--shadow-lg)',
      },
      // Shared admin-suite structural scale — from design/tokens.css. See
      // DESIGN.md. Byte-identical token source in Billiards_MyaThida and
      // MyaThida_Game; each app maps it into Tailwind its own way (this is
      // the v3 mapping — the v4 app maps the same vars via @theme inline).
      //
      // Deliberately additive only, new key names, nothing here overrides a
      // Tailwind default (text-sm, duration-150, etc.) — this file is wiring,
      // not a restyle, and an overridden default would silently change every
      // existing usage of that class across the whole app.
      maxWidth: {
        form: 'var(--w-form)',
        list: 'var(--w-list)',
        dashboard: 'var(--w-dashboard)',
      },
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        nav: 'var(--z-nav)',
        backdrop: 'var(--z-backdrop)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        tooltip: 'var(--z-tooltip)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
    },
  },
  plugins: [],
}

export default config
