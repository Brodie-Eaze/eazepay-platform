/**
 * EazePay color tokens. Semantic naming, not raw hex. Light + dark
 * variants for every semantic role; AAA contrast on body text, AA
 * elsewhere. Brand foundations live in the Figma file; this module is
 * the code-side source of truth that platforms import.
 *
 * Production swap: generated from Style Dictionary + Figma Variables.
 * Today these are hand-keyed defaults to unblock app development.
 */
export type ThemeMode = 'light' | 'dark';

export interface ColorPalette {
  // Backgrounds
  bgDefault: string;
  bgElevated: string;
  bgInverse: string;
  bgMuted: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  textMuted: string;
  textLink: string;
  textOnAccent: string;

  // Borders
  borderDefault: string;
  borderStrong: string;
  borderFocus: string;

  // Brand accent
  accentDefault: string;
  accentHover: string;
  accentPressed: string;

  // Intent
  successBg: string;
  successFg: string;
  warningBg: string;
  warningFg: string;
  dangerBg: string;
  dangerFg: string;
  infoBg: string;
  infoFg: string;
}

export const lightColors: ColorPalette = {
  bgDefault: '#FFFFFF',
  bgElevated: '#FBFBFD',
  bgInverse: '#0E1116',
  bgMuted: '#F2F4F7',

  textPrimary: '#0E1116',
  textSecondary: '#4A5568',
  textInverse: '#FFFFFF',
  textMuted: '#6B7280',
  textLink: '#1F4FE0',
  textOnAccent: '#FFFFFF',

  borderDefault: '#E5E7EB',
  borderStrong: '#9CA3AF',
  borderFocus: '#1F4FE0',

  accentDefault: '#1F4FE0',
  accentHover: '#173FB3',
  accentPressed: '#102E85',

  successBg: '#E6F8EE',
  successFg: '#0F7A3F',
  warningBg: '#FEF3C7',
  warningFg: '#92400E',
  dangerBg: '#FEE2E2',
  dangerFg: '#991B1B',
  infoBg: '#DBEAFE',
  infoFg: '#1E40AF',
};

export const darkColors: ColorPalette = {
  bgDefault: '#0E1116',
  bgElevated: '#1A1F27',
  bgInverse: '#FFFFFF',
  bgMuted: '#252C36',

  textPrimary: '#F3F4F6',
  textSecondary: '#CBD5E1',
  textInverse: '#0E1116',
  textMuted: '#94A3B8',
  textLink: '#7AA2FF',
  textOnAccent: '#FFFFFF',

  borderDefault: '#2A313B',
  borderStrong: '#4B5563',
  borderFocus: '#7AA2FF',

  accentDefault: '#3D6BFF',
  accentHover: '#5B83FF',
  accentPressed: '#7AA2FF',

  successBg: '#0F2D1F',
  successFg: '#34D399',
  warningBg: '#3B2A12',
  warningFg: '#FBBF24',
  dangerBg: '#3B1212',
  dangerFg: '#F87171',
  infoBg: '#1A2E5B',
  infoFg: '#7AA2FF',
};

export const colorsForTheme = (mode: ThemeMode): ColorPalette =>
  mode === 'dark' ? darkColors : lightColors;
