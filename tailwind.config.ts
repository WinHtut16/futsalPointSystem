import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
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
        // Design token aliases — map to CSS vars in globals.css.
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
      },
      fontFamily: {
        display: ['var(--font-sora)', 'Noto Sans Myanmar', 'system-ui', 'sans-serif'],
        body: ['var(--font-manrope)', 'Noto Sans Myanmar', 'system-ui', 'sans-serif'],
        fbmono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
        my: ['var(--font-noto-my)', 'var(--font-sora)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'fb-sm': 'var(--shadow-sm)',
        'fb-md': 'var(--shadow-md)',
        'fb-lg': 'var(--shadow-lg)',
      },
      borderRadius: {
        'r-sm': 'var(--r-sm)',
        'r-md': 'var(--r-md)',
        'r-lg': 'var(--r-lg)',
        'r-xl': 'var(--r-xl)',
        'r-2xl': 'var(--r-2xl)',
      },
    },
  },
  plugins: [],
}

export default config
