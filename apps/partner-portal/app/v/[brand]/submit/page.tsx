'use client';
import { useParams, notFound } from 'next/navigation';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { SubmitApplicationPage } from '../../../../components/SubmitApplicationPage';
import { partnerOrg } from '../../../../lib/mock-data';

/**
 * Per-brand Submit page. A vertical partner sees ONLY their brand's
 * application here — no cross-vertical leak. The "Copy Application
 * Link" produces a partner-unique URL that carries `?ref=<partnerId>`,
 * so every click maps back to the partner in the master Command
 * Centre for attribution + tracking.
 *
 * URLs (matching Lovable):
 *   EAZE Pay   → https://eazepay.lovable.app/?ref=<partner>
 *   Med Pay    → https://eazemedpay.lovable.app/?ref=<partner>
 *   Trade Pay  → https://eazetradepay.lovable.app/?ref=<partner>
 *
 * Lender filtering: once a client opens the link and runs through
 * Highsale's soft-pull on the apply landing, the lender pool shown to
 * them is filtered by the master's PartnerLenderAccess matrix —
 * exactly the toggles flipped at /lender-marketplace/access.
 */

interface BrandSubmitConfig {
  eyebrow: string;
  title: string;
  description: string;
  applyBase: string;
}

const CONFIG: Record<BrandCode, BrandSubmitConfig | null> = {
  coachpay: {
    eyebrow: 'EAZE PAY',
    title: 'Submit EAZE Pay Application',
    description:
      'Coaching & consulting financing for clients seeking professional development and business coaching services.',
    applyBase: 'https://eazepay.lovable.app/',
  },
  medpay: {
    eyebrow: 'MED PAY',
    title: 'Submit Med Pay Application',
    description:
      'Medical financing for patients seeking healthcare procedures, treatments, and wellness services.',
    applyBase: 'https://eazemedpay.lovable.app/',
  },
  tradepay: {
    eyebrow: 'TRADE PAY',
    title: 'Submit Trade Pay Application',
    description:
      'Trade & contractor financing for home improvement, HVAC, plumbing, and skilled trade services.',
    applyBase: 'https://eazetradepay.lovable.app/',
  },
  direct: null,
};

export default function BrandSubmitPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brand) notFound();
  const cfg = CONFIG[brand!];
  if (!cfg) notFound();

  // Partner-unique copy-link. Carries `?ref=<partnerId>` so every
  // signed client click is attributable to this partner in the master
  // Command Centre. The "Start Application" button opens the same
  // flow inside our portal (local /apply/<brand> route) so admins can
  // walk the apply experience without leaving the dashboard.
  const partnerLink = `${cfg!.applyBase}?ref=${encodeURIComponent(partnerOrg.id)}`;
  const localApply = `/apply/${BRANDS[brand!].slug}?ref=${encodeURIComponent(partnerOrg.id)}`;

  return (
    <SubmitApplicationPage
      config={{
        eyebrow: cfg!.eyebrow,
        title: cfg!.title,
        description: cfg!.description,
        applyHref: localApply,
        linkUrl: partnerLink,
      }}
    />
  );
}
