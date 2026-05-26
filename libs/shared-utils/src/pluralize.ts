/**
 * Canonical count + noun formatter. Resolves the 6/8 hardcoded
 * plural-`s` suffixes flagged by the audit.
 *
 *   pluralize(0, 'application')  → '0 applications'
 *   pluralize(1, 'application')  → '1 application'
 *   pluralize(2, 'application')  → '2 applications'
 *   pluralize(1, 'lender', 'lenders') → '1 lender'
 *   pluralize(3, 'child', 'children') → '3 children'
 *
 * If `plural` is omitted, the default is `singular + 's'`. English-only;
 * if we ever ship i18n we'll swap this for `Intl.PluralRules`.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}
