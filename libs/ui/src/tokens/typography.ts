/** Type scale + role tokens. Inter for body / SF Pro Display for hero
 *  on iOS — picked at the platform layer; this module just declares the
 *  semantic roles. All sizes in px. */
export const fontSizes = {
  caption: 12,
  bodySm: 14,
  body: 16,
  bodyLg: 18,
  h6: 20,
  h5: 24,
  h4: 32,
  h3: 40,
  h2: 48,
  h1: 56,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  tight: 1.15,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export type FontSizeToken = keyof typeof fontSizes;
