/** @type {import('tailwindcss').Config} */
const preset = require('@eazepay/ui/tailwind-preset');
module.exports = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../libs/ui/src/web/**/*.{ts,tsx}',
  ],
};
