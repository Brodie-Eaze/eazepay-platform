/**
 * EazePay shared Tailwind preset.
 *
 * Tokens are RGB triplets in CSS variables so Tailwind utilities support
 * the `<alpha-value>` syntax via `rgb(var(--token) / <alpha-value>)`.
 * The reference shadcn HSL tokens (--background, --card, --sidebar-*)
 * are also exposed in globals.css for direct `hsl(var(--…))` usage.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--bg-elevated) / <alpha-value>)',
        'bg-muted': 'rgb(var(--bg-muted) / <alpha-value>)',
        'bg-inverse': 'rgb(var(--bg-inverse) / <alpha-value>)',
        surface: 'rgb(var(--surface-overlay) / <alpha-value>)',
        card: 'rgb(var(--bg-elevated) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-secondary': 'rgb(var(--fg-secondary) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        'fg-on-accent': 'rgb(var(--fg-on-accent) / <alpha-value>)',
        'fg-inverse': 'rgb(var(--fg-inverse) / <alpha-value>)',
        'fg-link': 'rgb(var(--fg-link) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        'border-focus': 'rgb(var(--border-focus) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          strong: 'rgb(var(--accent-strong) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          bg: 'rgb(var(--success-bg) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          bg: 'rgb(var(--warning-bg) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          bg: 'rgb(var(--danger-bg) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          bg: 'rgb(var(--info-bg) / <alpha-value>)',
        },

        /* Sidebar palette — dark navy treatment carried across light + dark modes */
        sidebar: {
          DEFAULT: 'rgb(var(--sidebar-bg) / <alpha-value>)',
          fg: 'rgb(var(--sidebar-fg) / <alpha-value>)',
          'accent-bg': 'rgb(var(--sidebar-accent-bg) / <alpha-value>)',
          'accent-fg': 'rgb(var(--sidebar-accent-fg) / <alpha-value>)',
          'section-fg': 'rgb(var(--sidebar-section-fg) / <alpha-value>)',
          border: 'rgb(var(--sidebar-border-rgb) / <alpha-value>)',
        },

        /* Status palette — matches reference status-* tokens */
        status: {
          submitted: 'rgb(var(--status-submitted-rgb) / <alpha-value>)',
          review:    'rgb(var(--status-review-rgb) / <alpha-value>)',
          approved:  'rgb(var(--status-approved-rgb) / <alpha-value>)',
          declined:  'rgb(var(--status-declined-rgb) / <alpha-value>)',
          funded:    'rgb(var(--status-funded-rgb) / <alpha-value>)',
        },

        chart: {
          1: 'rgb(var(--chart-1) / <alpha-value>)',
          2: 'rgb(var(--chart-2) / <alpha-value>)',
          3: 'rgb(var(--chart-3) / <alpha-value>)',
          4: 'rgb(var(--chart-4) / <alpha-value>)',
          5: 'rgb(var(--chart-5) / <alpha-value>)',
          6: 'rgb(var(--chart-6) / <alpha-value>)',
          7: 'rgb(var(--chart-7) / <alpha-value>)',
          8: 'rgb(var(--chart-8) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        'display-xl': ['56px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['44px', { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '700' }],
        display: ['32px', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '700' }],
        h1: ['28px', { lineHeight: '1.2', letterSpacing: '-0.005em', fontWeight: '600' }],
        h2: ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.5' }],
        small: ['13px', { lineHeight: '1.4' }],
        micro: ['11px', { lineHeight: '1.3', letterSpacing: '0.04em' }],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(2px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
      },
    },
  },
  plugins: [],
};
