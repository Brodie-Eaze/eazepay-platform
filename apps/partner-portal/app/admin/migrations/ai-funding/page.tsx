'use client';

/**
 * /admin/migrations/ai-funding — AI Funding → MedPay migration queue.
 *
 * The July 1 cutover workspace. Every customer closed during the
 * AI Funding launch window (May 25 → June 30) appears here. Operators
 * batch-seed the queue, then trigger migrations individually or in
 * bulk. Per-customer status, retries, and rollback are surfaced here.
 *
 * Reads `lib/orchestrator/migration.ts` via /api/admin/migrations.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface StepState {
  name: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
  completedAt: string | null;
  note: string | null;
}

interface MigrationRecord {
  id: string;
  sourceCustomerId: string;
  targetPartnerId: string | null;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  steps: StepState[];
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<MigrationRecord['status'], { label: string; bg: string; fg: string }> = {
  queued: { label: 'Queued', bg: '#1f2937', fg: '#a3b8d4' },
  in_progress: { label: 'Migrating', bg: '#1e3a5f', fg: '#7dd3fc' },
  completed: { label: 'Completed', bg: '#14532d', fg: '#86efac' },
  failed: { label: 'Failed', bg: '#5b1e1e', fg: '#fca5a5' },
  rolled_back: { label: 'Rolled back', bg: '#5b3e1e', fg: '#fcd34d' },
};

export default function AiFundingMigrationPage(): JSX.Element {
  const [migrations, setMigrations] = useState<MigrationRecord[]>([]);
  const [seedInput, setSeedInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch('/api/admin/migrations', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { migrations: MigrationRecord[] };
      setMigrations(data.migrations);
    }
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    return {
      queued: migrations.filter((m) => m.status === 'queued').length,
      in_progress: migrations.filter((m) => m.status === 'in_progress').length,
      completed: migrations.filter((m) => m.status === 'completed').length,
      failed: migrations.filter((m) => m.status === 'failed').length,
    };
  }, [migrations]);

  async function seedBulk() {
    setBusy(true);
    const ids = seedInput
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setBusy(false);
      return;
    }
    await fetch('/api/admin/migrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceCustomerIds: ids }),
    });
    setSeedInput('');
    await refresh();
    setBusy(false);
  }

  async function startOne(id: string) {
    await fetch(`/api/admin/migrations/${id}`, { method: 'POST' });
    await refresh();
  }

  async function startAllQueued() {
    setBusy(true);
    const queued = migrations.filter((m) => m.status === 'queued');
    await Promise.all(
      queued.map((m) => fetch(`/api/admin/migrations/${m.id}`, { method: 'POST' })),
    );
    await refresh();
    setBusy(false);
  }

  return (
    <div style={{ padding: 32, maxWidth: 1280, margin: '0 auto', color: '#e2e8f0' }}>
      <Link href="/admin" style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}>
        ← Admin
      </Link>

      <header style={{ marginTop: 16, marginBottom: 22 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#fcd34d', fontWeight: 700 }}>
          JULY 1 CUTOVER · MIGRATION QUEUE
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700 }}>AI Funding → MedPay</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 720 }}>
          Walk every customer closed during May–June onto the MedPay infrastructure (HighSale +
          Lender Marketplace + MiCamp). Per-customer retries and rollback live in each row.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 18,
        }}
      >
        {(['queued', 'in_progress', 'completed', 'failed'] as const).map((k) => (
          <div
            key={k}
            style={{
              padding: 14,
              border: '1px solid #1f2937',
              borderRadius: 10,
              background: '#0f172a',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {k.replace('_', ' ')}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: STATUS_TONE[k].fg, marginTop: 4 }}>
              {counts[k]}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: 18,
          border: '1px solid #1f2937',
          borderRadius: 12,
          background: '#0f172a',
          marginBottom: 22,
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Seed migration queue</h3>
        <textarea
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder={'ai_cust_001\nai_cust_002\nai_cust_003'}
          style={{
            width: '100%',
            minHeight: 70,
            padding: 10,
            background: '#020617',
            color: '#e2e8f0',
            border: '1px solid #1f2937',
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: 12,
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            onClick={seedBulk}
            disabled={busy || !seedInput.trim()}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: '#0ea5e9',
              color: '#0c1a2e',
              border: 0,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
              opacity: !seedInput.trim() ? 0.6 : 1,
            }}
          >
            Queue migrations
          </button>
          <button
            onClick={startAllQueued}
            disabled={busy || counts.queued === 0}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: '#16a34a',
              color: '#06170c',
              border: 0,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
              opacity: counts.queued === 0 ? 0.6 : 1,
            }}
          >
            Start all queued ({counts.queued})
          </button>
        </div>
      </div>

      {migrations.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#64748b',
            border: '1px dashed #334155',
            borderRadius: 12,
          }}
        >
          No migrations yet. Seed the queue above with AI Funding customer ids.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {migrations.map((m) => (
            <div
              key={m.id}
              style={{
                padding: 16,
                border: '1px solid #1f2937',
                borderRadius: 10,
                background: '#0f172a',
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr 2fr auto',
                gap: 18,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{m.sourceCustomerId}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {m.targetPartnerId ? `→ ${m.targetPartnerId}` : 'pending partner creation'}
                </div>
              </div>
              <div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    background: STATUS_TONE[m.status].bg,
                    color: STATUS_TONE[m.status].fg,
                  }}
                >
                  {STATUS_TONE[m.status].label}
                </span>
                {m.failureReason && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#fca5a5' }}>
                    {m.failureReason}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {m.steps.map((s) => {
                  const c =
                    s.status === 'done'
                      ? '#10b981'
                      : s.status === 'in_progress'
                        ? '#0ea5e9'
                        : s.status === 'failed'
                          ? '#ef4444'
                          : s.status === 'skipped'
                            ? '#94a3b8'
                            : '#475569';
                  return (
                    <span
                      key={s.name}
                      title={`${s.name}: ${s.status}${s.note ? ` — ${s.note}` : ''}`}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 5,
                        fontSize: 10.5,
                        fontWeight: 600,
                        background: `${c}22`,
                        color: c,
                        border: `1px solid ${c}55`,
                      }}
                    >
                      {s.name.replace(/_/g, ' ')}
                    </span>
                  );
                })}
              </div>
              {m.status === 'queued' ? (
                <button
                  onClick={() => startOne(m.id)}
                  style={{
                    padding: '6px 10px',
                    background: '#0ea5e9',
                    color: '#0c1a2e',
                    border: 0,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Start
                </button>
              ) : (
                <span style={{ fontSize: 11.5, color: '#64748b' }}>
                  {m.startedAt ? new Date(m.startedAt).toLocaleTimeString() : '—'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
