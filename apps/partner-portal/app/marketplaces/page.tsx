import { redirect } from 'next/navigation';

/**
 * The standalone Marketplaces registry was consolidated into the
 * Lender Network catalog. The old page duplicated the catalog view at
 * a different aggregation level — operators kept asking why both
 * existed. Anyone hitting `/marketplaces` now lands on the unified
 * Lender Network page, which carries the marketplace as a column +
 * filter instead of a separate route.
 *
 * Keep this file (as a redirect) so deep links from old emails,
 * bookmarks, and embedded reports still resolve.
 */
export default function MarketplacesRedirect() {
  redirect('/lender-marketplace');
}
