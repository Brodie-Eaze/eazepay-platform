'use client';

/**
 * /admin/audit — Platform-wide audit log viewer.
 *
 * Distinct from the per-application event log (which lives on the
 * application detail page). This is the admin-action log: lender
 * toggles, vertical-config publishes, partner suspensions, MID
 * status changes, provisioning runs.
 *
 * Source: `audit_log` table when DATABASE_URL is set, synthetic
 * fixture otherwise.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  payloadJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_TONE: Record<string, string> = {
  'lender.toggle': '#7dd3fc',
  'vertical_config.publish': '#86efac',
  'partner.suspend': '#fca5a5',
  'partner.reactivate': '#86efac',
  'mid.status_change': '#fcd34d',
  'provision.complete': '#86efac',
  'provision.failed': '#fca5a5',
  'migration.complete': '#86efac',
};

export default function AuditLogPage(): JSX.Element {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [source, setSource] = useState<'db' | 'synthetic'>('synthetic');
  const [filterActor, setFilterActor] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterActor) params.set('actor', filterActor);
    if (filterAction) params.set('action', filterAction);
    if (filterTargetType) params.set('targetType', filterTargetType);
    const url = `/api/admin/audit${params.toString() ? `?${params}` : ''}`;
    setLoading(true);
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { source: 'db' | 'synthetic'; entries: AuditEntry[] }) => {
        setSource(d.source);
        setEntries(d.entries);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterActor, filterAction, filterTargetType]);

  const uniqueActors = useMemo(
    () => Array.from(new Set(entries.map((e) => e.actor))).sort(),
    [entries],
  );
  const uniqueActions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries],
  );
  const uniqueTargetTypes = useMemo(
    () => Array.from(new Set(entries.map((e) => e.targetType))).sort(),
    [entries],
  );

  return (
    <div style={{ padding: 32, maxWidth: 1240, margin: '0 auto', color: '#e2e8f0' }}>
      <Link href="/admin" style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}>
        ← Admin
      </Link>

      <header
        style={{
          marginTop: 16,
          marginBottom: 22,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <div>
          <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#7dd3fc', fontWeight: 700 }}>
            AUDIT LOG
          </div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700 }}>Platform actions</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 660 }}>
            Every admin action across the platform · search by actor, action, or target type.
          </p>
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: source === 'db' ? '#14532d' : '#1f2937',
            color: source === 'db' ? '#86efac' : '#a3b8d4',
          }}
        >
          source: {source}
        </span>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr auto',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <Select
          label="Actor"
          value={filterActor}
          onChange={setFilterActor}
          options={uniqueActors}
        />
        <Select
          label="Action"
          value={filterAction}
          onChange={setFilterAction}
          options={uniqueActions}
        />
        <Select
          label="Target type"
          value={filterTargetType}
          onChange={setFilterTargetType}
          options={uniqueTargetTypes}
        />
        <button
          onClick={() => {
            setFilterActor('');
            setFilterAction('');
            setFilterTargetType('');
          }}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #334155',
            background: 'transparent',
            color: '#cbd5e1',
            fontSize: 13,
            cursor: 'pointer',
            alignSelf: 'flex-end',
          }}
        >
          Clear
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
          Loading audit entries…
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: '#64748b',
            border: '1px dashed #334155',
            borderRadius: 12,
          }}
        >
          No entries match these filters.
        </div>
      ) : (
        <div
          style={{
            border: '1px solid #1f2937',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#0f172a',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#020617', textAlign: 'left', color: '#94a3b8' }}>
                <th style={th}>When</th>
                <th style={th}>Actor</th>
                <th style={th}>Action</th>
                <th style={th}>Target</th>
                <th style={th}>Payload</th>
                <th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderTop: '1px solid #1f2937' }}>
                  <td style={td}>{new Date(e.createdAt).toLocaleString()}</td>
                  <td style={td}>
                    <strong style={{ color: '#e2e8f0' }}>{e.actor}</strong>
                  </td>
                  <td style={td}>
                    <span style={{ color: ACTION_TONE[e.action] ?? '#cbd5e1', fontWeight: 600 }}>
                      {e.action}
                    </span>
                  </td>
                  <td style={td}>
                    {e.targetType}{' '}
                    {e.targetId && <span style={{ color: '#64748b' }}>· {e.targetId}</span>}
                  </td>
                  <td style={{ ...td, maxWidth: 340 }}>
                    {e.payloadJson ? (
                      <code style={{ fontSize: 11, color: '#a5b4fc' }}>{e.payloadJson}</code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ ...td, color: '#64748b', fontSize: 12 }}>{e.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}): JSX.Element {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: '#020617',
          border: '1px solid #1f2937',
          borderRadius: 8,
          color: '#e2e8f0',
          fontSize: 13,
        }}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

const th: React.CSSProperties = {
  padding: '12px 16px',
  fontWeight: 600,
  fontSize: 11.5,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'top' };
