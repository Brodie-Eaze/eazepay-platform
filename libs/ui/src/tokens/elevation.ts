/** Semantic elevation tokens. Each platform translates to native
 *  shadows / iOS layer shadows / Android elevation. Production export
 *  via Style Dictionary lands platform-specific shapes. */
export const elevation = {
  none: 0,
  card: 1,
  popover: 2,
  modal: 3,
  toast: 4,
} as const;

export type ElevationToken = keyof typeof elevation;
