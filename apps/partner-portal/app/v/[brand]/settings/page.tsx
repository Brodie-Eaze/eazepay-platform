'use client';
import { useParams } from 'next/navigation';
import { PageHeader, PageBody, Card, CardBody, StatusPill } from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';

/**
 * Brand-scoped Settings. Mirrors the Lovable merchant-portal
 * "Account → Settings" route. Will expose brand-themable bits a
 * partner can self-serve (logo, payout bank, webhook endpoints).
 */
export default function BrandSettingsPage() {
  const params = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === params.brand) as BrandCode | undefined;
  const brandName = brand ? BRANDS[brand].name : params.brand;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: brandName, href: `/v/${params.brand}` },
          { label: 'Settings' },
        ]}
        title="Settings"
        description={`Account preferences scoped to the ${brandName} brand.`}
      />
      <PageBody>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <StatusPill tone="info">Coming soon</StatusPill>
              <span className="text-fg-muted text-[13px]">
                Self-serve branding, payout bank, webhook endpoints. Sidebar slot
                reserved to match the Lovable layout.
              </span>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
