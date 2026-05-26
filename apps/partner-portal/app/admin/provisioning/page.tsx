'use client';

/**
 * /admin/provisioning — Provisioning queue
 *
 * Live view of every one-config provisioning run on the platform.
 * Polls /api/onboarding/provision every 3s for status updates.
 *
 * Driven by `lib/orchestrator/provision.ts` — each row represents
 * a partner being walked through HighSale → Marketplace defaults →
 * MiCamp → Partner-portal seed in sequence.
 *
 * Operators use this page to:
 *   • Watch new partner onboardings complete in real-time
 *   • Spot failed runs and which step blew up
 *   • Drill into a single run's per-step result payload
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProvisionRun, StepStatus } from '@/lib/orchestrator/provision';

type StatusFilter = 'all' | 'queued' | 'running' | 'completed' | 'failed';

const STATUS_BADGE: Record<ProvisionRun['status'], { label: string; bg: string; fg: string }> = {
  queued: { label: 'Queued', bg: '#1f2937', fg: '#a3b8d4' },
  running: { label: 'Running', bg: '#1e3a5f', fg: '#7dd3fc' },
  completed: { label: 'Completed', bg: '#14532d', fg: '#86efac' },
  failed: { label: 'Failed', bg: '#5b1e1e', fg: '#fca5a5' },
};

const STEP_TONE: Record<StepStatus, string> = {
  pending: '#475569',
  in_progress: '#0ea5e9',
  done: '#10b981',
  failed: '#ef4444',
  skipped: '#64748b',
};

const STEP_LABEL: Record<string, string> = {
  highsale_subaccount: 'HighSale',
  marketplace_defaults: 'Marketplace',
  micamp_mid: 'MiCamp',
  partner_portal_seed: 'Portal Seed',
};

export default function ProvisioningQueuePage(): JSX.Element {
  const [runs, setRuns] = useState<ProvisionRun[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/onboarding/provision', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { runs: ProvisionRun[] };
        if (!cancelled) {
          setRuns(data.runs);
          setLoading(false);
        }
      } catch {
        /* swallow — next poll will retry */
      }
    }
    void poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return runs;
    return runs.filter((r) => r.status === filter);
  }, [runs, filter]);

  const counts = useMemo(() => {
    return {
      all: runs.length,
      queued: runs.filter((r) => r.status === 'queued').length,
      running: runs.filter((r) => r.status === 'running').length,
      completed: runs.filter((r) => r.status === 'completed').length,
      failed: runs.filter((r) => r.status === 'failed').length,
    };
  }, [runs]);

  return (
    <div style={{ padding: '32px', maxWidth: 1240, margin: '0 auto', color: '#e2e8f0' }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#7dd3fc', fontWeight: 700 }}>
          ADMIN · ONE-CONFIG ONBOARDING
        </div>
        <h1
          style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          Provisioning queue
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 680 }}>
          Every partner being walked through HighSale → Marketplace → MiCamp → Portal seed. Updates
          every 3 seconds. Click into a run for the per-step result payload.
        </p>
      </header>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['all', 'queued', 'running', 'completed', 'failed'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 600,
              border: filter === s ? '1px solid #7dd3fc' : '1px solid #334155',
              background: filter === s ? 'rgba(125, 211, 252, 0.10)' : 'transparent',
              color: filter === s ? '#7dd3fc' : '#cbd5e1',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {s} <span style={{ opacity: 0.7, marginLeft: 4 }}>{counts[s]}</span>
          </button>
        ))}
      </nav>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>Loading runs…</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#64748b',
            border: '1px dashed #334155',
            borderRadius: 12,
          }}
        >
          No runs match this filter. Kick off a provisioning run via{' '}
          <code style={{ color: '#a5b4fc' }}>POST /api/onboarding/provision</code>.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((run) => (
            <Link
              key={run.id}
              href={`/admin/provisioning/${run.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                style={{
                  padding: 20,
                  border: '1px solid #1f2937',
                  borderRadius: 12,
                  background: '#0f172a',
                  display: 'grid',
                  gridTemplateColumns: '1.6fr 1fr 2fr auto',
                  gap: 24,
                  alignItems: 'center',
                  transition: 'border-color 120ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1f2937')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{run.partnerId}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    {run.brand.toUpperCase()} · {new Date(run.startedAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: STATUS_BADGE[run.status].bg,
                      color: STATUS_BADGE[run.status].fg,
                    }}
                  >
                    {STATUS_BADGE[run.status].label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {run.steps.map((s) => (
                    <span
                      key={s.name}
                      title={`${STEP_LABEL[s.name] ?? s.name}: ${s.status}${s.note ? ` — ${s.note}` : ''}`}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 600,
                        background: `${STEP_TONE[s.status]}22`,
                        color: STEP_TONE[s.status],
                        border: `1px solid ${STEP_TONE[s.status]}55`,
                      }}
                    >
                      {STEP_LABEL[s.name] ?? s.name}
                    </span>
                  ))}
                </div>
                <div style={{ color: '#7dd3fc', fontSize: 18 }}>→</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
