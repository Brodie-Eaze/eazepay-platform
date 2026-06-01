/** @type {import('tailwindcss').Config} */
const preset = require('@eazepay/ui/tailwind-preset');

module.exports = {
  presets: [preset],
  content: ['./app/**/*.{ts,tsx}', '../../libs/ui/src/web/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Net-new light-blue brand layer for the marketing site. The shared
      // preset is navy/grey/white only; these add the enterprise "sky"
      // accent + a deep-navy canvas used by the hero + lead-flow scenes.
      // Backed by --brand-* RGB-triplet vars defined in app/site.css.
      // Namespaced under `brand-*` so it never collides with Tailwind's
      // built-in `sky-*` palette.
      colors: {
        'brand-sky': 'rgb(var(--brand-sky) / <alpha-value>)',
        'brand-sky-soft': 'rgb(var(--brand-sky-soft) / <alpha-value>)',
        'brand-sky-deep': 'rgb(var(--brand-sky-deep) / <alpha-value>)',
        'brand-sky-wash': 'rgb(var(--brand-sky-wash) / <alpha-value>)',
        'brand-ink': 'rgb(var(--brand-ink) / <alpha-value>)',
        'brand-ink-soft': 'rgb(var(--brand-ink-soft) / <alpha-value>)',
      },
    },
  },
};
