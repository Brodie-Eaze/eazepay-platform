'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  Button,
  SearchIcon,
  ShieldIcon,
  DocIcon,
  ClockIcon,
  ArrowRightIcon,
  ExternalIcon,
  type StatusTone,
} from '@eazepay/ui/web';
import { formatTime } from '@eazepay/shared-utils/format-time';
import { auditLog, type AuditEntry } from '../../lib/master-data';

/**
 * Master audit log — append-only record of every state-changing action
 * the operator + system + partners take. Sourced from
 * lib/master-data.auditLog, filtered + paginated client-side.
 *
 * This page is the surface behind the UserMenu "My activity log" link
 * and behind the per-partner Activity tab "Open in audit log" CTAs.
 */

type Outcome = 'all' | 'success' | 'failed' | 'warning';

const outcomeTone: Record<Exclude<Outcome, 'all'>, StatusTone> = {
  success: 'success',
  failed: 'danger',
  warning: 'warning',
};

function relative(iso: string): string {
  return formatTime(iso, { mode: 'relative' });
}

const PAGE_SIZE = 25;

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('all');
  const [page, setPage] = useState(1);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const filtered = useMemo<AuditEntry[]>(() => {
    return auditLog.filter((e) => {
      if (outcome !== 'all' && e.outcome !== outcome) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.action.toLowerCase().includes(q) &&
          !e.target.toLowerCase().includes(q) &&
          !e.actor.toLowerCase().includes(q) &&
          !e.actorEmail.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [search, outcome]);

  const totals = useMemo(
    () => ({
      total: auditLog.length,
      success: auditLog.filter((e) => e.outcome === 'success').length,
      warning: auditLog.filter((e) => e.outcome === 'warning').length,
      failed: auditLog.filter((e) => e.outcome === 'failed').length,
    }),
    [],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportLog() {
    const lines = filtered
      .map((e) => [e.ts, e.actor, e.actorEmail, e.action, e.target, e.ip, e.outcome].join('\t'))
      .join('\n');
    if (typeof window !== 'undefined') {
      try {
        const blob = new Blob(
          [`timestamp\tactor\tactor_email\taction\ttarget\tip\toutcome\n${lines}`],
          { type: 'text/tab-separated-values' },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        /* fall through to toast-only */
      }
    }
    setExportMsg(`Exported ${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}`);
    setTimeout(() => setExportMsg(null), 3000);
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Account' }, { label: 'Audit log' }]}
        title="Audit log"
        description="Append-only record of every state-changing action across the platform. 7-year retention per AU record-keeping rules."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setExportMsg('Forwarded to siem@eazepay (mock)')}
            >
              <ExternalIcon size={12} /> Forward to SIEM
            </Button>
            <Button size="sm" variant="primary" onClick={exportLog}>
              <DocIcon size={12} /> Export TSV
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="Total entries" value={String(totals.total)} hint="last 90 days" />
          <Stat
            label="Successes"
            value={String(totals.success)}
            hint="state changes applied"
            tone="success"
          />
          <Stat label="Warnings" value={String(totals.warning)} hint="reviewable" tone="warning" />
          <Stat
            label="Failures"
            value={String(totals.failed)}
            hint="auto-retried"
            tone={totals.failed > 0 ? 'danger' : 'neutral'}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[260px] max-w-md">
            <SearchIcon size={14} className="text-fg-muted" />
            <input
              placeholder="Search action, actor, target, IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'success', 'warning', 'failed'] as Outcome[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  setOutcome(o);
                  setPage(1);
                }}
                className={
                  'h-10 px-3 rounded-md text-[12px] font-medium border ' +
                  (outcome === o
                    ? 'bg-fg text-white border-fg'
                    : 'bg-bg-elevated text-fg-secondary border-border hover:bg-bg-muted')
                }
              >
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader
            title={`${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}`}
            description="Newest first. Click an action to copy the audit ID, or open the related partner."
          />
          <CardBody className="p-0">
            <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
              <span className="col-span-2">Timestamp</span>
              <span className="col-span-2">Actor</span>
              <span className="col-span-3">Action</span>
              <span className="col-span-3">Target</span>
              <span className="col-span-1">IP</span>
              <span className="col-span-1 text-right">Outcome</span>
            </div>
            <ul className="divide-y divide-border">
              {slice.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-12 items-center px-5 py-3 text-[12px] hover:bg-bg-muted/30"
                >
                  <div className="col-span-2">
                    <p className="text-fg font-mono text-[11px]">
                      {e.ts.replace('T', ' ').slice(0, 16)}Z
                    </p>
                    <p className="text-[10px] text-fg-muted">{relative(e.ts)}</p>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <p className="font-medium text-fg truncate">{e.actor}</p>
                    <p className="text-[10px] text-fg-muted truncate">{e.actorEmail}</p>
                  </div>
                  <div className="col-span-3 font-mono text-[11px] text-fg-secondary">
                    {e.action}
                  </div>
                  <div className="col-span-3 text-fg truncate">{e.target}</div>
                  <div className="col-span-1 font-mono text-[10px] text-fg-muted">{e.ip}</div>
                  <div className="col-span-1 text-right">
                    <StatusPill tone={outcomeTone[e.outcome]} dot>
                      {e.outcome}
                    </StatusPill>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <p className="text-[11px] text-fg-muted">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(filtered.length, page * PAGE_SIZE)}{' '}
                of {filtered.length}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 text-[12px] rounded-md border border-border hover:bg-bg-muted disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 text-[12px] rounded-md border border-border hover:bg-bg-muted disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardBody>
              <div className="flex items-start gap-3">
                <span className="size-9 rounded-lg bg-bg-muted text-fg flex items-center justify-center shrink-0">
                  <ShieldIcon size={16} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-fg">SOC 2 retention</p>
                  <p className="text-[11px] text-fg-muted leading-snug mt-0.5">
                    7-year append-only retention per AU record-keeping rules. Hashed each hour and
                    anchored to the chain root.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-start gap-3">
                <span className="size-9 rounded-lg bg-bg-muted text-fg flex items-center justify-center shrink-0">
                  <ClockIcon size={16} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-fg">Real-time fanout</p>
                  <p className="text-[11px] text-fg-muted leading-snug mt-0.5">
                    Each entry is also fired to the EventBridge audit stream so external SIEMs
                    (Datadog, Splunk) stay current.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-start gap-3">
                <span className="size-9 rounded-lg bg-bg-muted text-fg flex items-center justify-center shrink-0">
                  <DocIcon size={16} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-fg">
                    Compliance framework
                    <Link
                      href="/legal/compliance"
                      className="ml-1 text-accent hover:underline inline-flex items-center gap-0.5 font-medium"
                    >
                      view <ArrowRightIcon size={10} />
                    </Link>
                  </p>
                  <p className="text-[11px] text-fg-muted leading-snug mt-0.5">
                    What we audit, who has access, and how decisions are reviewed.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </PageBody>

      {exportMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg">
          {exportMsg}
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatusTone;
}) {
  const accent =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-fg';
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1.5 text-[22px] font-bold tracking-tight leading-none ${accent}`}>
        {value}
      </p>
      {hint && <p className="text-[10px] text-fg-muted mt-1.5">{hint}</p>}
    </div>
  );
}
