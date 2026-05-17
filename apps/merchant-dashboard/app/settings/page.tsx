import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  DataRow,
  Button,
  StatusPill,
  Money,
  Banner,
  ArrowRightIcon,
  WebhookIcon,
} from '@eazepay/ui/web';
import { merchantOrg } from '../../lib/mock-data';

export default function MerchantSettings() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Settings' }]}
        title="Settings"
        description="Business, banking, processors, pricing, and branding."
      />
      <PageBody>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Business"
              action={
                <Button size="sm" variant="ghost">
                  Edit
                </Button>
              }
            />
            <CardBody>
              <DataRow label="Legal name" value={merchantOrg.legalName} />
              <DataRow label="DBA" value={merchantOrg.displayName} />
              <DataRow label="EIN" value="•••-••-7821" />
              <DataRow label="Formation state" value={merchantOrg.state} />
              <DataRow
                label="MCC / industry"
                value={`${merchantOrg.mcc} · ${merchantOrg.industry}`}
              />
              <DataRow
                label="EazePay brand"
                value={<StatusPill tone="accent">TradePay</StatusPill>}
              />
              <DataRow
                label="KYB"
                value={<StatusPill tone="success">Verified · 2025-08-12</StatusPill>}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Settlement banking" />
            <CardBody>
              <DataRow
                label="Settlement account"
                value={<span className="font-mono text-[12px]">Chase ••••2104</span>}
              />
              <DataRow
                label="Routing"
                value={<span className="font-mono text-[12px]">021••••89</span>}
              />
              <DataRow
                label="Verification"
                value={<StatusPill tone="success">PennyDrop + Plaid</StatusPill>}
              />
              <DataRow label="RTP enabled" value={<StatusPill tone="success">Yes</StatusPill>} />
              <DataRow label="Payout cadence" value="Daily (T+1 default; same-day RTP available)" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-3">
                  MiCamp
                  <StatusPill tone="success" dot>
                    Card processor · live
                  </StatusPill>
                </span>
              }
              description="Card-present and card-not-present acceptance for your storefront, terminal, and recurring billing. Settles same-day to your operating account."
              action={
                <Button size="sm" variant="ghost">
                  Manage
                </Button>
              }
            />
            <CardBody>
              <DataRow
                label="MID"
                value={<span className="font-mono text-[12px]">444•••••3120</span>}
              />
              <DataRow label="Accepted networks" value="Visa · Mastercard · Discover · Amex" />
              <DataRow
                label="3DS / risk-based step-up"
                value={<StatusPill tone="success">Enabled</StatusPill>}
              />
              <DataRow label="Card-present (terminal)" value="2.65% + $0.10" />
              <DataRow label="Card-not-present" value="2.95% + $0.30" />
              <DataRow label="Disputes ratio (90d)" value="0.18%" />
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="secondary" leadingIcon={<WebhookIcon size={14} />}>
                  Webhooks
                </Button>
                <Button size="sm" variant="ghost" trailingIcon={<ArrowRightIcon size={14} />}>
                  Open MiCamp dashboard
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-3">
                  HighSale
                  <StatusPill tone="success" dot>
                    EZ Check · live
                  </StatusPill>
                </span>
              }
              description="Electronic-check (RCC + Web-debit) processor for one-time and recurring debits. Great for high-ticket sales where card fees eat margin."
              action={
                <Button size="sm" variant="ghost">
                  Manage
                </Button>
              }
            />
            <CardBody>
              <DataRow
                label="Account"
                value={<span className="font-mono text-[12px]">hs_acct_R2NQp8</span>}
              />
              <DataRow label="Verification" value="Plaid Auth · micro-deposit fallback" />
              <DataRow
                label="Per-debit cap"
                value={<Money cents={250_000_00} compact noFractions />}
              />
              <DataRow label="Pricing" value="0.75% + $0.50 · capped at $25" />
              <DataRow
                label="Pre-debit notice"
                value={<StatusPill tone="success">10-day enforced</StatusPill>}
              />
              <DataRow label="Return rate (60d)" value="0.31%" />
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="secondary" leadingIcon={<WebhookIcon size={14} />}>
                  Webhooks
                </Button>
                <Button size="sm" variant="ghost" trailingIcon={<ArrowRightIcon size={14} />}>
                  Open HighSale dashboard
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pricing (EazePay financing)" />
            <CardBody>
              <DataRow label="MDR" value="2.85% (per financed sale)" />
              <DataRow label="Application fee" value={<Money cents={0} />} />
              <DataRow label="Reserve" value="0%" />
              <DataRow label="Chargeback policy" value="Standard · 60-day window" />
              <DataRow label="Pricing reviewed" value="Quarterly · next 2026-07-01" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Branding"
              description="Applied to your hosted application links and emails."
            />
            <CardBody>
              <Banner intent="info" className="mb-3">
                Upload your logo + brand color so the consumer apply flow reads as a co-branded
                experience. EazePay always shows the lender of record on the offer screen.
              </Banner>
              <DataRow label="Logo" value="pacificsolar.svg · 2025-08-12" />
              <DataRow
                label="Brand color"
                value={
                  <span className="flex items-center gap-2">
                    <span className="size-4 rounded" style={{ background: '#0066CC' }} /> #0066CC
                  </span>
                }
              />
              <DataRow label="Support email" value="support@pacificsolar.com" />
              <DataRow label="Support phone" value="(415) 555-0199" />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
