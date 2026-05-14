'use client';
import { Field, TextInput, SelectInput } from './fields';
import type { BeneficialOwner, StepProps } from './state';

/**
 * Step 3 — Business Details + Beneficial Owners.
 *
 * Two parts:
 *   • A small block of operational details (years in business, employee
 *     count).
 *   • A repeating "beneficial owners" section — FinCEN BOI requires any
 *     owner ≥25% plus a control person. The wizard enforces the
 *     ownership sum = 100% rule at the page level.
 */
export default function StepBusinessDetails({ state, setState, errors }: StepProps) {
  const setOwnerField =
    (i: number, k: keyof BeneficialOwner) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setState((s) => {
        const owners = s.owners.slice();
        const o = owners[i];
        if (!o) return s;
        const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
        owners[i] = { ...o, [k]: v } as BeneficialOwner;
        return { ...s, owners };
      });
    };

  const addOwner = () => {
    setState((s) => ({
      ...s,
      owners: [
        ...s.owners,
        {
          firstName: '',
          lastName: '',
          title: 'Director',
          ownershipPercentage: '0',
          email: '',
          phone: '',
          isControlPerson: false,
        },
      ],
    }));
  };

  const removeOwner = (i: number) => {
    setState((s) => ({ ...s, owners: s.owners.filter((_, j) => j !== i) }));
  };

  const ownershipTotal = state.owners.reduce((sum, o) => sum + Number(o.ownershipPercentage || 0), 0);

  return (
    <div className="space-y-8">
      {/* Operational details */}
      <section>
        <h2 className="text-[15px] font-semibold text-fg mb-3">About your operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Years in business"
            required
            error={errors['yearsInBusiness']}
            hint="0 if newly formed."
          >
            <TextInput
              type="number"
              min="0"
              max="200"
              value={state.yearsInBusiness}
              onChange={(e) => setState((s) => ({ ...s, yearsInBusiness: e.target.value }))}
              invalid={!!errors['yearsInBusiness']}
            />
          </Field>
          <Field label="Employee count" hint="Approximate is fine.">
            <SelectInput
              value={state.employeeCount}
              onChange={(e) => setState((s) => ({ ...s, employeeCount: e.target.value }))}
            >
              <option value="">Select…</option>
              <option value="1">Just me</option>
              <option value="2-5">2–5</option>
              <option value="6-20">6–20</option>
              <option value="21-50">21–50</option>
              <option value="51-200">51–200</option>
              <option value="200+">200+</option>
            </SelectInput>
          </Field>
        </div>
      </section>

      {/* Beneficial owners */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Beneficial owners</h2>
            <p className="text-[12px] text-fg-muted mt-0.5">
              Anyone with ≥25% ownership, plus a control person (officer or director).
              Ownership must sum to 100%.
            </p>
          </div>
          <span
            className={
              'text-[12px] font-semibold px-2 py-0.5 rounded-full ' +
              (ownershipTotal === 100
                ? 'bg-bg-inverse text-white'
                : 'bg-bg-muted text-fg-secondary border border-border')
            }
          >
            {ownershipTotal}% total
          </span>
        </div>

        {errors['ownership_total'] && (
          <p className="text-[12px] text-fg font-semibold mb-3">{errors['ownership_total']}</p>
        )}

        <div className="space-y-4">
          {state.owners.map((o, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-fg">
                  Owner #{i + 1}
                  {o.isControlPerson && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider bg-bg-muted text-fg-secondary px-1.5 py-0.5 rounded">
                      Control person
                    </span>
                  )}
                </h3>
                {state.owners.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOwner(i)}
                    className="text-[12px] text-fg-muted hover:text-fg"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="First name" required error={errors[`owner_${i}_firstName`]}>
                  <TextInput
                    value={o.firstName}
                    onChange={setOwnerField(i, 'firstName')}
                    invalid={!!errors[`owner_${i}_firstName`]}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last name" required error={errors[`owner_${i}_lastName`]}>
                  <TextInput
                    value={o.lastName}
                    onChange={setOwnerField(i, 'lastName')}
                    invalid={!!errors[`owner_${i}_lastName`]}
                    autoComplete="family-name"
                  />
                </Field>
                <Field label="Title" required error={errors[`owner_${i}_title`]}>
                  <TextInput
                    placeholder="CEO, Owner, President…"
                    value={o.title}
                    onChange={setOwnerField(i, 'title')}
                    invalid={!!errors[`owner_${i}_title`]}
                  />
                </Field>
                <Field label="Ownership %" required hint="0–100">
                  <TextInput
                    type="number"
                    min="0"
                    max="100"
                    value={o.ownershipPercentage}
                    onChange={setOwnerField(i, 'ownershipPercentage')}
                  />
                </Field>
                <Field label="Email" required error={errors[`owner_${i}_email`]}>
                  <TextInput
                    type="email"
                    value={o.email}
                    onChange={setOwnerField(i, 'email')}
                    invalid={!!errors[`owner_${i}_email`]}
                    autoComplete="email"
                  />
                </Field>
                <Field label="Phone">
                  <TextInput
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={o.phone}
                    onChange={setOwnerField(i, 'phone')}
                  />
                </Field>
                <label className="md:col-span-2 flex items-center gap-2 text-[13px] text-fg-secondary cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={o.isControlPerson}
                    onChange={setOwnerField(i, 'isControlPerson')}
                    className="h-4 w-4 rounded border-border text-[#0d1530] focus:ring-[#0d1530]"
                  />
                  This person is the control person (officer or director)
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addOwner}
          className="mt-3 h-10 px-4 rounded-md border border-dashed border-border text-[13px] font-medium text-fg-secondary hover:text-fg hover:border-border-strong"
        >
          + Add another owner
        </button>
      </section>
    </div>
  );
}
