'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardBody, Logo } from '@eazepay/ui/web';
import {
  findInvoiceByConfirmToken,
  setConfirmState,
  readInvoiceOverrides,
  computeInvoiceForPartner,
} from '../../../../../lib/invoicing';
import { partners as MASTER_PARTNERS } from '../../../../../lib/master-data';
import { BillingApi, BillingApiError, isBillingApiAvailable } from '../../../../../lib/billing-api';

/**
 * Recipient confirm/dispute page — what the business owner lands on
 * when they click the link in the invoice email. Public, token-gated.
 */
type ResolvedView = {
  state: 'pending' | 'confirmed' | 'disputed';
  disputeReason: string | null;
  invoice: {
    invoiceNo: string;
    merchant: string;
    vertical: string | null;
    periodLabel: string;
    grossFundedCents: number;
    feePct: number;
    amountCents: number;
    dueDate: string;
  };
};

/**
 * Recipient confirm/dispute page.
 *
 * Calls the public BFF (`/public/billing/confirm/<token>`) when the
 * API is reachable; falls back to localStorage adapters so the demo
 * keeps working offline. Either way the recipient sees the same UX.
 */
export default function InvoiceConfirmPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [view, setView] = useState<ResolvedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await isBillingApiAvailable()) {
          const r = await BillingApi.resolveConfirmToken(token);
          if (cancelled) return;
          setView({
            state: r.state,
            disputeReason: r.disputeReason,
            invoice: {
              invoiceNo: r.invoice.invoiceNo,
              merchant: r.invoice.merchant,
              vertical: r.invoice.vertical,
              periodLabel: r.invoice.periodLabel,
              grossFundedCents: Number(r.invoice.grossFundedCents),
              feePct: r.invoice.feeBps / 10000,
              amountCents: Number(r.invoice.amountCents),
              dueDate: r.invoice.dueDate,
            },
          });
        } else {
          // Offline path — read localStorage.
          const found = findInvoiceByConfirmToken(token);
          if (!found) {
            setView(null);
            return;
          }
          const ov = readInvoiceOverrides()[found.invoiceNo];
          const partnerId = found.invoiceNo.split('-').slice(3).join('-');
          const partner = MASTER_PARTNERS.find((p) => p.id === partnerId);
          if (!partner) {
            setView(null);
            return;
          }
          const computed = computeInvoiceForPartner({
            partnerId: partner.id,
            product: partner.product,
            fundedNetCents: partner.netCents,
          });
          setView({
            state: ov?.confirm?.state ?? 'pending',
            disputeReason: ov?.confirm?.disputeReason ?? null,
            invoice: {
              invoiceNo: found.invoiceNo,
              merchant: partner.legalName,
              vertical: partner.product,
              periodLabel: 'current',
              grossFundedCents: computed.grossFundedCents,
              feePct: computed.feePct,
              amountCents: ov?.customFeeCents ?? computed.feeAmountCents,
              dueDate: ov?.dueDate ?? '',
            },
          });
        }
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof BillingApiError && e.status === 404
            ? 'Invalid or expired link.'
            : 'Could not load this invoice. Try again later.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading)
    return (
      <PublicShell>
        <p>Loading…</p>
      </PublicShell>
    );

  if (error || !view) {
    return (
      <PublicShell>
        <p className="text-[14px] text-fg-secondary">
          {error ??
            'This confirmation link is no longer valid. Please reach out to your account manager if you believe this is in error.'}
        </p>
      </PublicShell>
    );
  }

  const state = view.state;
  const feeCents = view.invoice.amountCents;
  const partner = { legalName: view.invoice.merchant, product: view.invoice.vertical };
  const computed = {
    grossFundedCents: view.invoice.grossFundedCents,
    feePct: view.invoice.feePct,
  };
  const found = { invoiceNo: view.invoice.invoiceNo };

  const act = async (decision: 'confirm' | 'dispute') => {
    try {
      if (await isBillingApiAvailable()) {
        const r = await BillingApi.applyConfirmDecision(
          token,
          decision,
          decision === 'dispute' ? reason.trim() || undefined : undefined,
        );
        setView({
          ...view,
          state: r.state,
          disputeReason: decision === 'dispute' ? reason.trim() || null : null,
        });
      } else {
        setConfirmState(
          found.invoiceNo,
          decision === 'confirm' ? 'confirmed' : 'disputed',
          'recipient',
          decision === 'dispute' ? reason.trim() || 'no reason' : undefined,
        );
        setView({
          ...view,
          state: decision === 'confirm' ? 'confirmed' : 'disputed',
          disputeReason: decision === 'dispute' ? reason.trim() || null : null,
        });
      }
    } catch (e) {
      setError(
        e instanceof BillingApiError && e.status === 409
          ? 'This invoice has already been actioned.'
          : 'Could not record your response — please try again.',
      );
    }
  };

  const confirm = () => act('confirm');
  const dispute = () => act('dispute');

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

      {error && <p className="mt-4 text-[12px] text-rose-700">{error}</p>}

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
              {state === 'disputed' && view.disputeReason && (
                <span> · Reason: {view.disputeReason}</span>
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
