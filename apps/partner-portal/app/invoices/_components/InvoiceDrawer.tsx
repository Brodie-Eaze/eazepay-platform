'use client';
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  StatusPill,
} from '@eazepay/ui/web';

// Local form primitives — the shared <Input/Select/Textarea> are
// label-wrapper components designed for full-size forms. Inside the
// drawer we want the native elements so we can compose tight grids.
const fieldInputCn =
  'mt-0.5 w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-border-focus';
const fieldSelectCn = fieldInputCn + ' pr-7 appearance-none';
const fieldTextareaCn =
  'mt-0.5 w-full rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-border-focus';
const fieldLabelCn = 'text-[10px] uppercase tracking-wider font-semibold text-fg-muted';
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <span className={fieldLabelCn}>{label}</span>
    {children}
  </div>
);
import {
  recordPayment,
  voidInvoice,
  unvoidInvoice,
  setDueDate,
  type InvoiceStatus,
  type PaymentMethod,
  type InvoicePayment,
  type InvoiceActivity,
} from '../../../lib/invoicing';

export interface DrawerInvoice {
  invoiceNo: string;
  merchant: string;
  email: string;
  partnerId: string;
  vertical: string;
  periodLabel: string;
  grossFundedCents: number;
  feePct: number;
  feeAmountCents: number;
  status: InvoiceStatus;
  dueDate: string;
  voided: boolean;
  voidReason?: string;
  payments: InvoicePayment[];
  activity: InvoiceActivity[];
}

interface Props {
  invoice: DrawerInvoice | null;
  actor: string;
  onClose: () => void;
  onMutated: () => void;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtPct(p: number): string {
  return `${(p * 100).toFixed(2)}%`;
}
function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'ach', label: 'ACH' },
  { value: 'wire', label: 'Wire' },
  { value: 'card', label: 'Card' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

export function InvoiceDrawer({ invoice, actor, onClose, onMutated }: Props) {
  const open = !!invoice;
  if (!invoice) return <Dialog open={false} onOpenChange={() => onClose()} />;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{invoice.merchant}</span>
            <span className="font-mono text-[12px] text-fg-muted">{invoice.invoiceNo}</span>
            {invoice.voided && (
              <StatusPill tone="danger" dot>
                Voided
              </StatusPill>
            )}
          </DialogTitle>
          <DialogDescription>
            {invoice.vertical} · {invoice.periodLabel} · {invoice.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          <Summary invoice={invoice} />
          <DueDateEditor invoice={invoice} actor={actor} onSaved={onMutated} />
          <PaymentsSection invoice={invoice} actor={actor} onSaved={onMutated} />
          <ActivitySection items={invoice.activity} />
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <VoidControls invoice={invoice} actor={actor} onSaved={onMutated} onClose={onClose} />
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ invoice }: { invoice: DrawerInvoice }) {
  const paid = invoice.payments.reduce((s, p) => s + p.amountCents, 0);
  const balance = Math.max(0, invoice.feeAmountCents - paid);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat label="Gross funded" value={fmtUsd(invoice.grossFundedCents)} />
      <Stat label="Fee" value={`${fmtPct(invoice.feePct)} · ${fmtUsd(invoice.feeAmountCents)}`} />
      <Stat label="Paid" value={fmtUsd(paid)} />
      <Stat label="Balance" value={fmtUsd(balance)} emphasis={balance > 0 ? 'amber' : 'emerald'} />
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: 'amber' | 'emerald';
}) {
  const tone =
    emphasis === 'amber'
      ? 'text-amber-700'
      : emphasis === 'emerald'
        ? 'text-emerald-700'
        : 'text-fg';
  return (
    <div className="rounded-lg border border-border bg-bg-elevated px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1 text-[14px] font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function DueDateEditor({
  invoice,
  actor,
  onSaved,
}: {
  invoice: DrawerInvoice;
  actor: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(invoice.dueDate);
  const dirty = value !== invoice.dueDate;
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
        Due date
      </h3>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={fieldInputCn + ' max-w-[180px]'}
          aria-label="Due date"
        />
        <Button
          size="sm"
          variant={dirty ? 'primary' : 'ghost'}
          disabled={!dirty || !/^\d{4}-\d{2}-\d{2}$/.test(value)}
          onClick={() => {
            setDueDate(invoice.invoiceNo, value, actor);
            onSaved();
          }}
        >
          Save changes
        </Button>
      </div>
    </section>
  );
}

function PaymentsSection({
  invoice,
  actor,
  onSaved,
}: {
  invoice: DrawerInvoice;
  actor: string;
  onSaved: () => void;
}) {
  const paid = useMemo(
    () => invoice.payments.reduce((s, p) => s + p.amountCents, 0),
    [invoice.payments],
  );
  const remaining = Math.max(0, invoice.feeAmountCents - paid);

  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('ach');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      setError('Pick a valid payment date.');
      return;
    }
    const cents = Math.round(amt * 100);
    const willFullySettle = paid + cents >= invoice.feeAmountCents;
    recordPayment({
      invoiceNo: invoice.invoiceNo,
      amountCents: cents,
      paidAt,
      method,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      by: actor,
      markPaid: willFullySettle,
    });
    setReference('');
    setNote('');
    setError(null);
    onSaved();
  };

  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
        Record payment
      </h3>
      <div className="rounded-lg border border-border bg-bg-elevated p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Amount (USD)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldInputCn + ' tabular-nums'}
          />
        </Field>
        <Field label="Paid at">
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className={fieldInputCn}
          />
        </Field>
        <Field label="Method">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className={fieldSelectCn}
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference (optional)">
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. ACH trace 1234"
            className={fieldInputCn}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={fieldTextareaCn}
            />
          </Field>
        </div>
        {error && <p className="sm:col-span-2 text-[11px] text-rose-600">{error}</p>}
        <div className="sm:col-span-2 flex items-center justify-between">
          <p className="text-[11px] text-fg-muted">
            Remaining balance: <strong className="text-fg">{fmtUsd(remaining)}</strong>
          </p>
          <Button size="sm" onClick={submit}>
            Record payment
          </Button>
        </div>
      </div>

      {invoice.payments.length > 0 && (
        <div className="mt-3">
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted mb-1">
            Payment history
          </h4>
          <ul className="rounded-lg border border-border divide-y divide-border text-[12px]">
            {invoice.payments
              .slice()
              .reverse()
              .map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="font-mono text-[11px] text-fg-muted w-20">{p.paidAt}</span>
                  <span className="uppercase text-[10px] tracking-wider text-fg-muted w-12">
                    {p.method}
                  </span>
                  <span className="font-semibold tabular-nums">{fmtUsd(p.amountCents)}</span>
                  {p.reference && (
                    <span className="font-mono text-[11px] text-fg-muted">{p.reference}</span>
                  )}
                  {p.note && (
                    <span className="text-fg-secondary truncate" title={p.note}>
                      {p.note}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ActivitySection({ items }: { items: InvoiceActivity[] }) {
  if (items.length === 0) {
    return (
      <section>
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
          Activity
        </h3>
        <p className="text-[12px] text-fg-muted">No activity recorded yet.</p>
      </section>
    );
  }
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
        Activity
      </h3>
      <ul className="border-l border-border ml-1 space-y-2">
        {items.map((a) => (
          <li key={a.id} className="relative pl-3 text-[12px]">
            <span className="absolute -left-[5px] top-1.5 size-2 rounded-full bg-border-focus" />
            <p className="text-fg">{a.summary}</p>
            <p className="text-[10px] text-fg-muted">
              {fmtDateTime(a.at)} · {a.by}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VoidControls({
  invoice,
  actor,
  onSaved,
  onClose,
}: {
  invoice: DrawerInvoice;
  actor: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');

  if (invoice.voided) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          unvoidInvoice(invoice.invoiceNo, actor);
          onSaved();
        }}
      >
        Unvoid
      </Button>
    );
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Void invoice
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        placeholder="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className={fieldInputCn + ' w-48 h-8'}
      />
      <Button
        size="sm"
        variant="danger"
        onClick={() => {
          voidInvoice(invoice.invoiceNo, reason.trim() || 'no reason', actor);
          onSaved();
          onClose();
        }}
      >
        Confirm void
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
