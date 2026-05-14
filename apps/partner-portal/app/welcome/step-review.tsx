'use client';
import { INDUSTRIES, type StepProps } from './state';

/**
 * Step 5 — Review.
 *
 * Read-only summary of every field captured in steps 1–4, followed by
 * the three compliance agreements (TILA-aware merchant agreement,
 * GLBA privacy notice, terms of service).
 *
 * Layout: dl-style summaries grouped by step, then the three checkbox
 * agreements with inline error states.
 */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-border last:border-b-0">
      <dt className="text-[12px] text-fg-muted">{label}</dt>
      <dd className="text-[13px] text-fg text-right">{value || '—'}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-fg-secondary mb-1.5">
        {title}
      </h3>
      <dl className="rounded-xl border border-border bg-bg-elevated px-4 py-1">{children}</dl>
    </section>
  );
}

export default function StepReview({ state, setState, errors }: StepProps) {
  const industry = INDUSTRIES.find((i) => i.code === state.industry);
  return (
    <div className="space-y-6">
      <Group title="Industry">
        <Row label="Vertical" value={industry?.title ?? ''} />
        <Row label="Brand" value={industry?.brand ?? ''} />
      </Group>

      <Group title="Business">
        <Row label="Legal name" value={state.legalName} />
        <Row label="DBA" value={state.dba} />
        <Row label="EIN" value={state.ein} />
        <Row label="Phone" value={state.phone} />
        <Row label="Website" value={state.website} />
        <Row
          label="Address"
          value={[
            state.addressLine1,
            state.addressLine2,
            [state.city, state.state, state.zip].filter(Boolean).join(', '),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      </Group>

      <Group title="Details">
        <Row label="Years in business" value={state.yearsInBusiness} />
        <Row label="Employees" value={state.employeeCount} />
        <Row
          label="Owners"
          value={state.owners
            .map((o) => `${o.firstName} ${o.lastName} (${o.ownershipPercentage}%)`)
            .join(', ')}
        />
      </Group>

      <Group title="Financial profile">
        <Row label="Bank" value={state.bankName} />
        <Row label="Account type" value={state.accountType} />
        <Row label="Routing" value={state.routingNumber ? `••••${state.routingNumber.slice(-4)}` : ''} />
        <Row label="Account" value={state.accountNumber ? `••••${state.accountNumber.slice(-4)}` : ''} />
        <Row label="Monthly volume" value={state.avgMonthlyVolume} />
        <Row label="Avg ticket" value={state.avgTicket} />
        <Row label="Processing history" value={state.hasProcessingHistory ? 'Yes' : 'No'} />
      </Group>

      {/* Agreements */}
      <section className="rounded-xl border border-border bg-bg-elevated p-5">
        <h3 className="text-[14px] font-semibold text-fg mb-3">Final agreements</h3>
        <div className="space-y-3">
          {[
            {
              key: 'acceptedTerms' as const,
              label: 'I accept the EazePay platform Terms of Service.',
              err: errors['terms'],
            },
            {
              key: 'acceptedPrivacy' as const,
              label:
                'I acknowledge the GLBA Privacy Notice and how EazePay collects and shares my non-public personal information.',
              err: errors['privacy'],
            },
            {
              key: 'signedAgreement' as const,
              label:
                'I am authorized to bind this business and I sign the Merchant Services Agreement (TILA + Reg Z disclosures attached).',
              err: errors['agreement'],
            },
          ].map((c) => (
            <div key={c.key}>
              <label className="flex items-start gap-3 cursor-pointer text-[13px] text-fg-secondary">
                <input
                  type="checkbox"
                  checked={state[c.key]}
                  onChange={(e) => setState((s) => ({ ...s, [c.key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-border text-[#0d1530] focus:ring-[#0d1530]"
                />
                <span>{c.label}</span>
              </label>
              {c.err && <p className="ml-7 mt-1 text-[11px] text-fg font-semibold">{c.err}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
