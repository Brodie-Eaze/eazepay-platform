import { notFound } from 'next/navigation';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import EazeAffiliatePage from '../../../../eaze-affiliate/page';
import MarketingConsultPage from '../../../../marketing-consult/page';
import SalesRecruitmentPage from '../../../../sales-recruitment/page';
import MarketplacePage from '../../../../marketplace/page';

/**
 * Per-brand Services route — keeps the partner inside their own
 * portal URL space (`/v/<brand>/services/<slug>`) while rendering the
 * same network-wide marketing content the master operator sees. This
 * is the "wall" between partner portals and the master operating
 * system: partners never resolve to `/eaze-affiliate`,
 * `/marketing-consult`, etc., which would expose the master surface.
 *
 * The four Service pages are intentionally re-used (not duplicated)
 * because they describe network-wide offerings (Affiliate program,
 * Agency picker, Marketplace) that don't change per brand. Brand
 * context is supplied by the surrounding Shell + sidebar; the page
 * content stays identical.
 */
const SERVICE_RENDERERS = {
  'eaze-affiliate': EazeAffiliatePage,
  'marketing-consult': MarketingConsultPage,
  'sales-recruitment': SalesRecruitmentPage,
  marketplace: MarketplacePage,
} as const;

type ServiceSlug = keyof typeof SERVICE_RENDERERS;

const SERVICE_SLUGS: ServiceSlug[] = [
  'eaze-affiliate',
  'marketing-consult',
  'sales-recruitment',
  'marketplace',
];

export function generateStaticParams() {
  const brands = BRAND_ORDER.filter((b) => b !== 'direct') as BrandCode[];
  return brands.flatMap((b) => SERVICE_SLUGS.map((slug) => ({ brand: BRANDS[b].slug, slug })));
}

export default function BrandServicesPage({ params }: { params: { brand: string; slug: string } }) {
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === params.brand);
  if (!brand) notFound();
  const Renderer = SERVICE_RENDERERS[params.slug as ServiceSlug];
  if (!Renderer) notFound();
  return <Renderer />;
}
