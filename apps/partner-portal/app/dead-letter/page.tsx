'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  Button as _Button,
  AlertIcon,
  ArrowRightIcon,
  type ButtonVariant,
  type ButtonSize,
} from '@eazepay/ui/web';

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;

/**
 * Dead Letter — messages parked after retry-budget exhaustion.
 * Combines webhook DLQ, notification DLQ, and lender-callback DLQ
 * into a single inspector.
 */

interface DlqRow {
  id: string;
  source: 'webhook' | 'notification' | 'lender-callback';
  reference: string;
  failure: string;
  attempts: number;
  firstSeen: string;
  lastTried: string;
  payloadBytes: number;
}

const DLQ_SEED: DlqRow[] = [
  { id: 'dlq_001', source: 'webhook',          reference: 'whk_evergreen application.routed',  failure: 'HTTP 503 — upstream rejected (5 attempts)',          attempts: 5, firstSeen: '2026-05-14T14:55Z', lastTried: '2026-05-14T21:54Z', payloadBytes: 1204 },
  { id: 'dlq_002', source: 'webhook',          reference: 'whk_atlas application.approved',    failure: 'TLS handshake timeout (3 attempts)',                attempts: 3, firstSeen: '2026-05-14T11:02Z', lastTried: '2026-05-14T17:01Z', payloadBytes: 982  },
  { id: 'dlq_003', source: 'notification',     reference: 'aan_a_0344 postal mailer',          failure: 'PDF rasterisation failed — missing font asset',     attempts: 2, firstSeen: '2026-05-13T22:14Z', lastTried: '2026-05-14T03:22Z', payloadBytes: 412  },
  { id: 'dlq_004', source: 'lender-callback',  reference: 'capitalone fund_ack a_022',         failure: 'Schema mismatch — expected_field "loan_id"',         attempts: 4, firstSeen: '2026-05-13T18:08Z', lastTried: '2026-05-14T08:18Z', payloadBytes: 631  },
  { id: 'dlq_005', source: 'notification',     reference: 'sms partner.payout_scheduled',      failure: 'Carrier opt-out — recipient blocked short codes',   attempts: 1, firstSeen: '2026-05-12T09:42Z', lastTried: '2026-05-12T09:42Z', payloadBytes: 184  },
];

export default function DeadLetterPage() {
  const [rows, setRows] = useState(DLQ_SEED);
  const [toast, setToast] = useState<string | null>(null);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }

  function replay(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    flash('Replayed and removed from dead-letter');
  }
  function discard(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    flash('Discarded permanently (audit logged)');
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: 'Dead Letter' }]}
        title="Dead Letter"
        description="Messages parked after retry exhaustion — inspect, replay, or discard. Discards are audit-logged."
        actions={
          <Button size="sm" variant="secondary" onClick={() => flash('Replay-all queued for healthy endpoints')}>
            Replay all healthy
          </Button>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="Total parked" value={String(rows.length)} tone={rows.length > 10 ? 'warning' : 'neutral'} />
          <Stat label="Webhook" value={String(rows.filter((r) => r.source === 'webhook').length)} />
          <Stat label="Notifications" value={String(rows.filter((r) => r.source === 'notification').length)} />
          <Stat label="Lender callbacks" value={String(rows.filter((r) => r.source === 'lender-callback').length)} />
        </div>

        <Card>
          <CardHeader title="Parked messages" description="Each row carries the full payload, failure reason, and replay button." />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusPill tone="warning" dot>
                          {r.source}
                        </StatusPill>
                        <span className="font-mono text-[11px] text-fg-muted">{r.id}</span>
                        <span className="text-[10px] text-fg-muted">·</span>
                        <span className="text-[11px] text-fg-muted">{r.attempts} attempts</span>
                        <span className="text-[10px] text-fg-muted">·</span>
                        <span className="text-[11px] text-fg-muted">{r.payloadBytes}B</span>
                      </div>
                      <p className="text-[13px] font-semibold text-fg">{r.reference}</p>
                      <p className="text-[12px] text-danger mt-0.5">{r.failure}</p>
                      <p className="text-[10px] text-fg-muted mt-1">
                        First seen {r.firstSeen} · last tried {r.lastTried}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="secondary" onClick={() => replay(r.id)}>Replay</Button>
                      <Button size="sm" variant="danger" onClick={() => discard(r.id)}>Discard</Button>
                    </div>
                  </div>
                </li>
              ))}
              {rows.length === 0 && (
                <li className="px-5 py-10 text-center text-[13px] text-fg-muted">
                  Dead-letter queue is empty. <Link href="/queues" className="text-accent hover:underline">View queues</Link>
                </li>
              )}
            </ul>
          </CardBody>
        </Card>
      </PageBody>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg flex items-center gap-2">
          <AlertIcon size={14} />
          {toast}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'success' | 'danger' | 'warning' | 'neutral' }) {
  const accent =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg';
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1.5 text-[22px] font-bold tracking-tight leading-none ${accent}`}>{value}</p>
    </div>
  );
}
