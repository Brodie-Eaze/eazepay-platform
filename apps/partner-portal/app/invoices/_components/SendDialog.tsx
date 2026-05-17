'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
} from '@eazepay/ui/web';
import { ensureConfirmToken, appendActivity } from '../../../lib/invoicing';
import { getBillingConfig, resolvePaymentLink } from '../../../lib/billing-config';

const inputCn =
  'mt-1 w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-border-focus';
const textareaCn =
  'mt-1 w-full rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[12px] font-mono outline-none focus:ring-2 focus:ring-border-focus';

export interface SendTarget {
  invoiceNo: string;
  merchant: string;
  email: string;
  subject: string;
  body: string;
  amountCents: number;
  partnerId: string;
  periodLabel: string;
  feePct: number;
  dueDate: string;
  grossFundedCents: number;
}

interface Props {
  target: SendTarget | null;
  onClose: () => void;
  onSent: (invoiceNo: string) => void;
}

function fmtUsd(c: number) {
  return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(p: number) {
  return `${(p * 100).toFixed(2)}%`;
}

const ACTOR = 'admin@eaze.test';

function buildDefaultBody(target: SendTarget, confirmUrl: string, payUrl: string | undefined) {
  const lines = [
    `Hi ${target.merchant} team,`,
    '',
    `Your ${target.periodLabel} EazePay platform-fee invoice is ready for confirmation.`,
    '',
    `Invoice:      ${target.invoiceNo}`,
    `Period:       ${target.periodLabel}`,
    `Gross funded: ${fmtUsd(target.grossFundedCents)}`,
    `Fee rate:     ${fmtPct(target.feePct)}`,
    `Amount due:   ${fmtUsd(target.amountCents)}`,
    `Due date:     ${target.dueDate}`,
    '',
    `▶ Confirm or dispute this invoice: ${confirmUrl}`,
  ];
  if (payUrl) lines.push(`▶ Pay now: ${payUrl}`);
  lines.push('', 'Reply to this email if anything needs reconciling.', '', '— EazePay FinOps');
  return lines.join('\n');
}

export function SendDialog({ target, onClose, onSent }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [confirmUrl, setConfirmUrl] = useState<string>('');
  const [payUrl, setPayUrl] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState('');

  const config = useMemo(
    () => (target ? getBillingConfig(target.partnerId) : null),
    [target?.partnerId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!target) return;
    const token = ensureConfirmToken(target.invoiceNo);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eazepay.app';
    const cUrl = `${origin}/invoices/confirm/${token}`;
    const pUrl = resolvePaymentLink(config?.paymentLinkTemplate, {
      amountCents: target.amountCents,
      invoiceNo: target.invoiceNo,
    });
    setConfirmUrl(cUrl);
    setPayUrl(pUrl);
    setSubject(target.subject);
    setBody(buildDefaultBody(target, cUrl, pUrl));
    setEmail(config?.sendToEmail ?? target.email);
  }, [target, config]);

  if (!target) return <Dialog open={false} onOpenChange={() => onClose()} />;

  const send = () => {
    const params = `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const href = `mailto:${encodeURIComponent(email)}${params}`;
    if (typeof window !== 'undefined') window.location.href = href;
    appendActivity(target.invoiceNo, {
      kind: 'send',
      by: ACTOR,
      summary: `Composed email to ${email}${payUrl ? ' · with pay link' : ''}`,
    });
    onSent(target.invoiceNo);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send {target.invoiceNo}</DialogTitle>
          <DialogDescription>
            To: <strong className="text-fg">{email}</strong> · {target.merchant}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <span className="block text-[11px] uppercase tracking-wider font-semibold text-fg-muted">
              Recipient
            </span>
            <input className={inputCn} value={email} onChange={(e) => setEmail(e.target.value)} />
            {config?.sendToEmail && (
              <p className="mt-1 text-[10px] text-fg-muted">
                Pre-filled from this merchant's billing config.
              </p>
            )}
          </div>

          <div>
            <span className="block text-[11px] uppercase tracking-wider font-semibold text-fg-muted">
              Subject
            </span>
            <input
              className={inputCn}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <span className="block text-[11px] uppercase tracking-wider font-semibold text-fg-muted">
              Body
            </span>
            <textarea
              className={textareaCn}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
            />
          </div>

          <div className="rounded-lg border border-border bg-bg-muted/40 px-3 py-2 text-[11px] space-y-1">
            <p className="text-fg-secondary">
              <strong>Confirm/dispute link:</strong>{' '}
              <span className="font-mono text-[10px] break-all">{confirmUrl}</span>
            </p>
            <p className="text-fg-secondary">
              <strong>Pay link:</strong>{' '}
              {payUrl ? (
                <span className="font-mono text-[10px] break-all">{payUrl}</span>
              ) : (
                <span className="text-fg-muted italic">
                  none — add a payment-link template in the Automation tab to enable.
                </span>
              )}
            </p>
          </div>

          <p className="text-[11px] text-fg-muted">
            Opens your mail client with the content pre-filled. In Phase B (Resend wired), this
            sends directly without opening the local composer.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={send}>
            Send via mail composer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
