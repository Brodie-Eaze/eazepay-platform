'use client';
import { Field, TextInput, SelectInput } from './fields';
import type { StepProps } from './state';

/**
 * Step 4 — Financial profile.
 *
 * Two clusters:
 *   • Settlement bank account — name, ABA routing, account, type. We
 *     never store these in plaintext beyond MVP; the bank is verified
 *     via Plaid Auth or micro-deposits in the backend.
 *   • Volume & ticket expectations — drives underwriting / risk bands.
 */
export default function StepFinancialProfile({ state, setState, errors }: StepProps) {
  const set =
    (k: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setState((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[15px] font-semibold text-fg mb-3">Settlement bank account</h2>
        <p className="text-[12px] text-fg-muted mb-4">
          Where we'll send your funded volume. Routing + account are encrypted and never surfaced in
          plaintext after submission.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Bank name" required error={errors['bankName']}>
            <TextInput
              placeholder="Chase, Wells Fargo, …"
              value={state.bankName}
              onChange={set('bankName')}
              invalid={!!errors['bankName']}
            />
          </Field>
          <Field label="Account type" required>
            <SelectInput value={state.accountType} onChange={set('accountType')}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </SelectInput>
          </Field>
          <Field
            label="ABA routing number"
            required
            error={errors['routingNumber']}
            hint="9 digits"
          >
            <TextInput
              placeholder="123456789"
              value={state.routingNumber}
              onChange={set('routingNumber')}
              invalid={!!errors['routingNumber']}
              inputMode="numeric"
              maxLength={9}
            />
          </Field>
          <Field label="Account number" required error={errors['accountNumber']} hint="4–17 digits">
            <TextInput
              placeholder="000123456789"
              value={state.accountNumber}
              onChange={set('accountNumber')}
              invalid={!!errors['accountNumber']}
              inputMode="numeric"
              maxLength={17}
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-fg mb-3">Volume + ticket</h2>
        <p className="text-[12px] text-fg-muted mb-4">
          Approximate — drives the underwriting band and the lender pool we route to.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Average monthly volume (USD)" required error={errors['avgMonthlyVolume']}>
            <SelectInput
              value={state.avgMonthlyVolume}
              onChange={set('avgMonthlyVolume')}
              invalid={!!errors['avgMonthlyVolume']}
            >
              <option value="">Select range…</option>
              <option value="0-10k">$0 – $10,000</option>
              <option value="10k-50k">$10,000 – $50,000</option>
              <option value="50k-250k">$50,000 – $250,000</option>
              <option value="250k-1m">$250,000 – $1M</option>
              <option value="1m+">$1M+</option>
            </SelectInput>
          </Field>
          <Field label="Average ticket size (USD)" required error={errors['avgTicket']}>
            <SelectInput
              value={state.avgTicket}
              onChange={set('avgTicket')}
              invalid={!!errors['avgTicket']}
            >
              <option value="">Select range…</option>
              <option value="0-500">Under $500</option>
              <option value="500-2500">$500 – $2,500</option>
              <option value="2500-10k">$2,500 – $10,000</option>
              <option value="10k-50k">$10,000 – $50,000</option>
              <option value="50k+">$50,000+</option>
            </SelectInput>
          </Field>
          <label className="md:col-span-2 flex items-center gap-2 text-[13px] text-fg-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={state.hasProcessingHistory}
              onChange={(e) => setState((s) => ({ ...s, hasProcessingHistory: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-[#0d1530] focus:ring-[#0d1530]"
            />
            We have prior card-processing history (statements available on request)
          </label>
        </div>
      </section>
    </div>
  );
}
