'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';

/**
 * Brand-scoped 404 fallback.
 *
 * Why this exists separately from the root `app/not-found.tsx`:
 *   The root fallback's "Go home" button links to `/` — which is the
 *   master operating system root. A merchant who hits a missing
 *   application detail page (e.g. typed a stale URL, or the seed
 *   doesn't contain the id they clicked) used to bounce out of their
 *   own portal into master OS. That's the wall-up leak the user
 *   flagged.
 *
 *   Next.js resolves the CLOSEST not-found.tsx, so this file beats the
 *   root for anything under `/v/[brand]/*`. The brand is read from
 *   useParams and the "Go home" button stays inside `/v/<brand>/`.
 */
export default function BrandNotFound() {
  const params = useParams<{ brand: string }>();
  const brandSlug = params?.brand ?? '';
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  const homeHref = brand ? `/v/${brandSlug}` : '/';
  const brandName = brand ? BRANDS[brand].name : 'EazePay';

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-md text-center space-y-5">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-fg-muted">404</p>
        <h1 className="text-[22px] font-semibold tracking-tight text-fg">
          We couldn&apos;t find that page in your {brandName} portal.
        </h1>
        <p className="text-[13px] leading-relaxed text-fg-secondary">
          The link may have expired, the record may have been removed, or you may not have access to
          it from this account.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href={homeHref}
            className="h-10 px-4 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] hover:bg-[#1a2a52] inline-flex items-center"
          >
            Back to {brandName}
          </Link>
          {brand && (
            <Link
              href={`/v/${brandSlug}/applications`}
              className="h-10 px-4 rounded-lg border border-border bg-bg-elevated text-fg-secondary font-semibold text-[13px] hover:bg-bg-muted inline-flex items-center"
            >
              View applications
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
