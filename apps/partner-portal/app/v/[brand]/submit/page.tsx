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
 * Apply URLs are served IN-PLATFORM from `/apply/<slug>?ref=<partner>`.
 * Each portal gets its own consumer apply form embedded in this
 * codebase — no external Lovable redirect, no third-party domain.
 *   EazePay   → /apply/coachpay?ref=<partner>
 *   MedPay    → /apply/medpay?ref=<partner>
 *   TradePay  → /apply/tradepay?ref=<partner>
 * The `SubmitApplicationPage` component fully-qualifies these paths
 * with `window.location.origin` at render time so the copyable link
 * and QR code carry the actual production domain.
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
}

const CONFIG: Record<BrandCode, BrandSubmitConfig | null> = {
  coachpay: {
    eyebrow: 'EAZE PAY',
    title: 'Submit EAZE Pay Application',
    description:
      'Coaching & consulting financing for clients seeking professional development and business coaching services.',
  },
  medpay: {
    eyebrow: 'MED PAY',
    title: 'Submit Med Pay Application',
    description:
      'Medical financing for patients seeking healthcare procedures, treatments, and wellness services.',
  },
  tradepay: {
    eyebrow: 'TRADE PAY',
    title: 'Submit Trade Pay Application',
    description:
      'Trade & contractor financing for home improvement, HVAC, plumbing, and skilled trade services.',
  },
  direct: null,
};

export default function BrandSubmitPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brand) notFound();
  const cfg = CONFIG[brand!];
  if (!cfg) notFound();

  // Partner-unique apply link. Points at the in-platform consumer
  // apply route under `/apply/<slug>?ref=<partnerId>` so every signed
  // client click maps back to the partner in the master Command
  // Centre. Both the "Start Application" button and the copy/QR/share
  // surfaces use the same in-platform path — the `SubmitApplicationPage`
  // component prepends window.location.origin for the copy/QR variants.
  const localApply = `/apply/${BRANDS[brand!].slug}?ref=${encodeURIComponent(partnerOrg.id)}`;

  return (
    <SubmitApplicationPage
      config={{
        eyebrow: cfg!.eyebrow,
        title: cfg!.title,
        description: cfg!.description,
        applyHref: localApply,
        linkUrl: localApply,
      }}
    />
  );
}
