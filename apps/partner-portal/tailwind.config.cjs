/** @type {import('tailwindcss').Config} */
const preset = require('@eazepay/ui/tailwind-preset');
module.exports = {
  presets: [preset],
  // CRITICAL: include ./components/. Many topbar/panel/tour components
  // live here (NotificationsPanel, KeyboardShortcuts, SavedViewsMenu,
  // MoreMenu, PartnerTour, NotificationBell, …) and their Tailwind
  // utility classes were being silently dropped from the CSS bundle,
  // leaving panels that visually rendered but ignored translate /
  // pointer-events / transition rules. Surfaced when the notifications
  // panel stayed open and the X button didn't close it.
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../libs/ui/src/web/**/*.{ts,tsx}',
  ],
};
