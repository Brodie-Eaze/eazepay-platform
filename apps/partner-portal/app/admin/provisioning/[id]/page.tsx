'use client';

/**
 * /admin/provisioning/[id] — Single provisioning run detail
 *
 * Per-step view of a one-config provisioning run. Polls
 * /api/onboarding/provision/[id] every 2s until the run reaches a
 * terminal state.
 *
 * For each step we surface:
 *   • Status (pending → in_progress → done | failed | skipped)
 *   • Start + complete timestamps
 *   • Note (human-readable status detail)
 *   • Result payload (raw JSON, for debugging failed runs)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ProvisionRun, StepStatus } from '@/lib/orchestrator/provision';

const STATUS_BADGE: Record<ProvisionRun['status'], { label: string; bg: string; fg: string }> = {
  queued: { label: 'Queued', bg: '#1f2937', fg: '#a3b8d4' },
  running: { label: 'Running', bg: '#1e3a5f', fg: '#7dd3fc' },
  completed: { label: 'Completed', bg: '#14532d', fg: '#86efac' },
  failed: { label: 'Failed', bg: '#5b1e1e', fg: '#fca5a5' },
};

const STEP_TONE: Record<StepStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#64748b' },
  in_progress: { label: 'In progress', color: '#0ea5e9' },
  done: { label: 'Done', color: '#10b981' },
  failed: { label: 'Failed', color: '#ef4444' },
  skipped: { label: 'Skipped', color: '#94a3b8' },
};

const STEP_LABEL: Record<string, string> = {
  highsale_subaccount: 'HighSale sub-account',
  marketplace_defaults: 'Lender marketplace defaults',
  micamp_mid: 'MiCamp MID (pre-underwriting)',
  partner_portal_seed: 'Partner portal seed',
};

export default function ProvisioningRunPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [run, setRun] = useState<ProvisionRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/onboarding/provision/${id}`, { cache: 'no-store' });
        if (!res.ok) {
          setError(`Run ${id} not found`);
          return;
        }
        const data = (await res.json()) as ProvisionRun;
        if (!cancelled) {
          setRun(data);
          if (data.status === 'completed' || data.status === 'failed') {
            return; // stop polling
          }
        }
      } catch {
        /* swallow */
      }
    }
    void poll();
    const interval = setInterval(() => {
      if (run?.status === 'completed' || run?.status === 'failed') return;
      void poll();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, run?.status]);

  if (error) {
    return (
      <div style={{ padding: 32, color: '#fca5a5' }}>
        <Link href="/admin/provisioning" style={{ color: '#7dd3fc' }}>
          ← Back to queue
        </Link>
        <p style={{ marginTop: 16 }}>{error}</p>
      </div>
    );
  }

  if (!run) {
    return <div style={{ padding: 32, color: '#64748b' }}>Loading run…</div>;
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto', color: '#e2e8f0' }}>
      <Link
        href="/admin/provisioning"
        style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}
      >
        ← Provisioning queue
      </Link>

      <header style={{ marginTop: 16, marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: '0.18em',
            color: '#7dd3fc',
            fontWeight: 700,
          }}
        >
          PROVISIONING RUN
        </div>
        <h1 style={{ margin: '6px 0 10px', fontSize: 26, fontWeight: 700 }}>{run.id}</h1>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            Partner <strong style={{ color: '#e2e8f0' }}>{run.partnerId}</strong>
          </span>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            Brand <strong style={{ color: '#e2e8f0' }}>{run.brand}</strong>
          </span>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            Started {new Date(run.startedAt).toLocaleString()}
          </span>
          {run.completedAt && (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>
              · Completed {new Date(run.completedAt).toLocaleString()}
            </span>
          )}
        </div>
        {run.failureReason && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: '1px solid #5b1e1e',
              borderRadius: 8,
              background: 'rgba(91, 30, 30, 0.20)',
              color: '#fca5a5',
              fontSize: 13,
            }}
          >
            <strong>Failure:</strong> {run.failureReason}
          </div>
        )}
      </header>

      <div style={{ display: 'grid', gap: 14 }}>
        {run.steps.map((step, idx) => {
          const tone = STEP_TONE[step.status];
          return (
            <div
              key={step.name}
              style={{
                padding: 20,
                border: `1px solid ${tone.color}33`,
                borderRadius: 12,
                background: '#0f172a',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      color: tone.color,
                      fontWeight: 700,
                    }}
                  >
                    STEP {idx + 1} · {tone.label.toUpperCase()}
                  </div>
                  <h3
                    style={{
                      margin: '4px 0 0',
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    {STEP_LABEL[step.name] ?? step.name}
                  </h3>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'right' }}>
                  {step.startedAt && <div>↗ {new Date(step.startedAt).toLocaleTimeString()}</div>}
                  {step.completedAt && (
                    <div>✓ {new Date(step.completedAt).toLocaleTimeString()}</div>
                  )}
                </div>
              </div>

              {step.note && (
                <div style={{ color: '#cbd5e1', fontSize: 13.5, marginBottom: 10 }}>
                  {step.note}
                </div>
              )}

              {step.result && (
                <details>
                  <summary
                    style={{
                      cursor: 'pointer',
                      color: '#7dd3fc',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Result payload
                  </summary>
                  <pre
                    style={{
                      marginTop: 10,
                      padding: 12,
                      background: '#020617',
                      borderRadius: 8,
                      fontSize: 11.5,
                      color: '#cbd5e1',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(step.result, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
