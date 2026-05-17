'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardBody, Logo } from '@eazepay/ui/web';
import {
  findInvoiceByConfirmToken,
  setConfirmState,
  readInvoiceOverrides,
} from '../../../../lib/invoicing';
import { partners as MASTER_PARTNERS } from '../../../../lib/master-data';
import { computeInvoiceForPartner } from '../../../../lib/invoicing';

/**
 * Recipient confirm/dispute page — what the business owner lands on
 * when they click the link in the invoice email. Public, token-gated.
 */
export default function InvoiceConfirmPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [tick, setTick] = useState(0);
  const [reason, setReason] = useState('');

  const found = findInvoiceByConfirmToken(token);
  const invoiceNo = found?.invoiceNo ?? null;
  // partnerId is the suffix of the period-scoped invoice number.
  const partnerId = invoiceNo?.split('-').slice(3).join('-');
  const partner = partnerId ? MASTER_PARTNERS.find((p) => p.id === partnerId) : undefined;

  const override = invoiceNo ? readInvoiceOverrides()[invoiceNo] : undefined;
  const state = override?.confirm?.state ?? 'pending';

  const computed = partner
    ? computeInvoiceForPartner({
        partnerId: partner.id,
        product: partner.product,
        fundedNetCents: partner.netCents,
      })
    : null;
  const feeCents = override?.customFeeCents ?? computed?.feeAmountCents ?? 0;

  useEffect(() => {
    // No-op effect — `tick` re-render is wired through the action
    // handlers so the page reflects state without a full reload.
  }, [tick]);

  if (!found || !partner || !computed) {
    return (
      <PublicShell>
        <p className="text-[14px] text-fg-secondary">
          This confirmation link is no longer valid. Please reach out to your account manager if you
          believe this is in error.
        </p>
      </PublicShell>
    );
  }

  const confirm = () => {
    setConfirmState(found.invoiceNo, 'confirmed', 'recipient');
    setTick((t) => t + 1);
  };
  const dispute = () => {
    setConfirmState(found.invoiceNo, 'disputed', 'recipient', reason.trim() || 'no reason');
    setTick((t) => t + 1);
  };

  return (
    <PublicShell>
      <h1 className="text-[22px] font-semibold tracking-tight">Confirm your invoice</h1>
      <p className="mt-1 text-[13px] text-fg-muted">
        {partner.legalName} · {partner.product} · {found.invoiceNo}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Gross funded" value={fmtUsd(computed.grossFundedCents)} />
        <Stat label="Fee" value={`${(computed.feePct * 100).toFixed(2)}%`} />
        <Stat label="Amount due" value={fmtUsd(feeCents)} emphasis />
        <Stat label="Status" value={state.toUpperCase()} />
      </div>

      {state === 'pending' ? (
        <>
          <p className="mt-6 text-[13px] text-fg-secondary leading-relaxed">
            Review the amount above. If it matches your records, confirm. If not, dispute with a
            short reason and your account manager will follow up.
          </p>
          <div className="mt-4 grid gap-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional dispute reason"
              rows={3}
              className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-border-focus"
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={confirm}>Confirm invoice</Button>
            <Button variant="ghost" onClick={dispute}>
              Dispute
            </Button>
          </div>
        </>
      ) : (
        <Card className="mt-6">
          <CardBody>
            <p className="text-[14px] font-semibold text-fg">
              Thank you — your response has been recorded.
            </p>
            <p className="mt-1 text-[12px] text-fg-muted">
              Status: <strong>{state}</strong>
              {state === 'disputed' && override?.confirm?.disputeReason && (
                <span> · Reason: {override.confirm.disputeReason}</span>
              )}
            </p>
            <p className="mt-3 text-[12px] text-fg-muted">
              You can close this page. Your account manager has been notified.
            </p>
          </CardBody>
        </Card>
      )}
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Logo />
        <Link href="/" className="text-[12px] text-fg-muted hover:text-fg">
          eazepay.com
        </Link>
      </header>
      <section className="flex-1 max-w-2xl w-full mx-auto px-6 py-10">{children}</section>
    </main>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className={
        'rounded-lg border border-border px-4 py-3 ' +
        (emphasis ? 'bg-fg text-bg-elevated' : 'bg-bg-elevated text-fg')
      }
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold opacity-70">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
