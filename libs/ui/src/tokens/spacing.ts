/** 4-point grid; semantic aliases for layout density. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  jumbo: 40,
  huge: 56,
  giant: 80,
} as const;

export type SpacingToken = keyof typeof spacing;
