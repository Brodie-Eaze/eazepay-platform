'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  Button,
  StatusPill,
  Money,
  DollarIcon,
  InfoIcon,
} from '@eazepay/ui/web';
import { BRANDS, type BrandCode } from '@eazepay/shared-types';
import { partners as MASTER_PARTNERS_ROSTER } from '../../../../lib/master-data';
import {
  readInvoiceOverrides,
  computeInvoiceForPartner,
  ensureConfirmToken,
} from '../../../../lib/invoicing';
import { getBillingConfig, resolvePaymentLink } from '../../../../lib/billing-config';

/**
 * Per-brand merchant Billing page.
 *
 * Read-only view of the platform-fee invoices EazePay has issued
 * to this merchant. Pay button uses the configured payment-link
 * template (Stripe / MICAMP / other). "Confirm" button mints the
 * same confirm token the email link would use, so the merchant can
 * close the loop in-app instead of having to find the email.
 *
 * Demo data: pulls the brand's first partner from master-data and
 * reads its invoices from localStorage. Will swap to BillingApi
 * (scoped by signed-in merchant id) once auth is wired here.
 */

export default function MerchantBillingPage() {
  const params = useParams();
  const brand = (params?.brand as string) ?? 'medpay';
  const brandCode = brand as BrandCode;
  const brandConfig = BRANDS[brandCode];

  // Find a partner of this brand to act as "the signed-in merchant"
  // for the demo. Production will resolve the actual merchant from
  // the auth session.
  const partner = useMemo(
    () =>
      MASTER_PARTNERS_ROSTER.find(
        (p) => p.product.toLowerCase() === brandConfig?.name.toLowerCase(),
      ) ?? MASTER_PARTNERS_ROSTER[0]!,
    [brandConfig?.name],
  );

  const invoices = useMemo(() => {
    const overrides = readInvoiceOverrides();
    return Object.entries(overrides)
      .filter(([id]) => id.endsWith(`-${partner.id}`))
      .map(([invoiceNo, ov]) => {
        const computed = computeInvoiceForPartner({
          partnerId: partner.id,
          product: partner.product,
          fundedNetCents: partner.netCents,
        });
        const amount =
          typeof ov.customFeeCents === 'number' ? ov.customFeeCents : computed.feeAmountCents;
        const paid = (ov.payments ?? []).reduce((s, p) => s + p.amountCents, 0);
        const confirmState = ov.confirm?.state ?? null;
        return {
          invoiceNo,
          status: (ov.status ?? 'draft') as 'draft' | 'sent' | 'paid' | 'overdue',
          voided: !!ov.voidedAt,
          dueDate: ov.dueDate ?? '—',
          amountCents: amount,
          paidCents: paid,
          remainingCents: Math.max(0, amount - paid),
          feePct: computed.feePct,
          grossFundedCents: computed.grossFundedCents,
          confirmState,
        };
      })
      .sort((a, b) => b.invoiceNo.localeCompare(a.invoiceNo));
  }, [partner]);

  const config = useMemo(() => getBillingConfig(partner.id), [partner.id]);

  const outstanding = invoices
    .filter((i) => !i.voided && i.status !== 'paid')
    .reduce((s, i) => s + i.remainingCents, 0);
  const paidYtd = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amountCents, 0);

  const openPayLink = (invoiceNo: string, amountCents: number) => {
    const url = resolvePaymentLink(config.paymentLinkTemplate, { amountCents, invoiceNo });
    if (!url) {
      alert(
        'No payment link configured for this merchant yet. Contact your EazePay account manager.',
      );
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openConfirm = (invoiceNo: string) => {
    const token = ensureConfirmToken(invoiceNo);
    window.location.href = `/invoices/confirm/${token}`;
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: brandConfig?.name ?? 'Brand', href: `/v/${brand}` },
          { label: 'Billing' },
        ]}
        title="Billing"
        description="Platform-fee invoices issued by EazePay. Confirm an invoice once you've reviewed, or pay using the link your account manager provided."
      />
      <PageBody>
        <Card className="mb-4">
          <CardBody className="flex items-start gap-3 px-5 py-4">
            <span className="text-fg-muted mt-0.5">
              <InfoIcon size={16} />
            </span>
            <div className="flex-1 text-[13px] text-fg-secondary leading-relaxed">
              EazePay charges a platform-fee on funded volume, billed monthly. Default vertical rate
              for <strong>{brandConfig?.name ?? brand}</strong> is{' '}
              <strong>{(VERTICAL_FEE_PCT(brand) * 100).toFixed(1)}%</strong>; per-merchant rates may
              vary by agreement.
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <Stat label="Outstanding" value={<Money cents={outstanding} />} tone="amber" />
          <Stat label="Paid year-to-date" value={<Money cents={paidYtd} />} tone="emerald" />
          <Stat label="Invoices on file" value={invoices.length} />
        </div>

        <Card>
          <CardHeader title="Your invoices" description={`${invoices.length} on file`} />
          <CardBody className="p-0">
            {invoices.length === 0 ? (
              <div className="px-5 py-12 text-center text-fg-muted text-[13px]">
                No invoices yet. They'll appear here once EazePay issues your first platform-fee
                bill.
              </div>
            ) : (
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Your invoices"
                tabIndex={0}
              >
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
                    <span className="col-span-3">Invoice</span>
                    <span className="col-span-2">Period · Due</span>
                    <span className="col-span-2 text-right">Gross funded</span>
                    <span className="col-span-2 text-right">Fee due</span>
                    <span className="col-span-1">Status</span>
                    <span className="col-span-2 text-right">Actions</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {invoices.map((i) => (
                      <li
                        key={i.invoiceNo}
                        className={`grid grid-cols-12 items-center px-5 py-3 text-[12px] ${i.voided ? 'opacity-60' : ''}`}
                      >
                        <div className="col-span-3 font-mono text-fg-secondary truncate">
                          {i.invoiceNo}
                          {i.voided && (
                            <span className="ml-1.5 text-rose-600 font-semibold">VOID</span>
                          )}
                        </div>
                        <div className="col-span-2 text-fg-muted text-[11px]">
                          <div>{i.invoiceNo.slice(4, 11)}</div>
                          <div>due {i.dueDate}</div>
                        </div>
                        <div className="col-span-2 text-right tabular-nums">
                          <Money cents={i.grossFundedCents} />
                          <p className="text-[10px] text-fg-muted">
                            {(i.feePct * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div className="col-span-2 text-right tabular-nums font-semibold">
                          <Money cents={i.amountCents} />
                          {i.paidCents > 0 && i.paidCents < i.amountCents && (
                            <p className="text-[10px] text-amber-700">
                              <Money cents={i.paidCents} /> paid
                            </p>
                          )}
                        </div>
                        <div className="col-span-1">
                          <StatusPill
                            tone={
                              i.status === 'paid'
                                ? 'success'
                                : i.status === 'overdue'
                                  ? 'danger'
                                  : i.status === 'sent'
                                    ? 'warning'
                                    : 'neutral'
                            }
                          >
                            {i.status}
                          </StatusPill>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          {!i.voided && i.status !== 'paid' && (
                            <>
                              {i.confirmState !== 'confirmed' && i.confirmState !== 'disputed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openConfirm(i.invoiceNo)}
                                >
                                  Confirm charge
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() =>
                                  openPayLink(i.invoiceNo, i.remainingCents || i.amountCents)
                                }
                              >
                                <DollarIcon size={11} /> Pay
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <p className="mt-4 text-[11px] text-fg-muted">
          Questions about an invoice? Reply to the email your account manager sent, or use the
          <strong> Confirm / Dispute</strong> link inside that email.
        </p>
      </PageBody>
    </>
  );
}

function VERTICAL_FEE_PCT(brand: string): number {
  switch (brand.toLowerCase()) {
    case 'medpay':
      return 0.035;
    case 'tradepay':
      return 0.05;
    case 'coachpay':
      return 0.06;
    default:
      return 0.045;
  }
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'amber' | 'emerald';
}) {
  const text =
    tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-fg';
  return (
    <div className="rounded-lg border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1 text-[18px] font-semibold tabular-nums ${text}`}>{value}</p>
    </div>
  );
}
