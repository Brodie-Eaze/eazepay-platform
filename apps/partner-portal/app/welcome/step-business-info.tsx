'use client';
import { Field, TextInput, SelectInput } from './fields';
import { US_STATES, type StepProps } from './state';

/**
 * Step 2 — Business info. Captures the legal-entity facts we need to
 * run KYB: legal name, DBA, EIN, contact, registered address.
 * Validation here is shape-level (length / regex); deeper checks
 * (SoS good-standing, IRS TIN match) run on the backend.
 */
export default function StepBusinessInfo({ state, setState, errors }: StepProps) {
  const set =
    (k: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setState((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Legal business name" required error={errors['legalName']}>
          <TextInput
            placeholder="Acme Industries, Inc."
            value={state.legalName}
            onChange={set('legalName')}
            invalid={!!errors['legalName']}
            autoComplete="organization"
          />
        </Field>
        <Field label="DBA / trading name" hint="Leave blank if same as legal name.">
          <TextInput placeholder="Acme" value={state.dba} onChange={set('dba')} />
        </Field>
        <Field label="Federal EIN" required error={errors['ein']} hint="Format: XX-XXXXXXX">
          <TextInput
            placeholder="12-3456789"
            value={state.ein}
            onChange={set('ein')}
            invalid={!!errors['ein']}
            inputMode="numeric"
            maxLength={10}
          />
        </Field>
        <Field label="Phone" required error={errors['phone']} hint="10-digit US number">
          <TextInput
            placeholder="(555) 123-4567"
            value={state.phone}
            onChange={set('phone')}
            invalid={!!errors['phone']}
            type="tel"
            autoComplete="tel"
          />
        </Field>
        <Field label="Website" className="md:col-span-2">
          <TextInput
            placeholder="https://acme.example"
            value={state.website}
            onChange={set('website')}
            type="url"
          />
        </Field>
        <Field
          label="Address line 1"
          required
          error={errors['addressLine1']}
          className="md:col-span-2"
        >
          <TextInput
            placeholder="Street address"
            value={state.addressLine1}
            onChange={set('addressLine1')}
            invalid={!!errors['addressLine1']}
            autoComplete="address-line1"
          />
        </Field>
        <Field label="Address line 2" className="md:col-span-2">
          <TextInput
            placeholder="Apt, suite, floor — optional"
            value={state.addressLine2}
            onChange={set('addressLine2')}
            autoComplete="address-line2"
          />
        </Field>
        <Field label="City" required error={errors['city']}>
          <TextInput
            placeholder="San Francisco"
            value={state.city}
            onChange={set('city')}
            invalid={!!errors['city']}
            autoComplete="address-level2"
          />
        </Field>
        <Field label="State" required error={errors['state']}>
          <SelectInput
            value={state.state}
            onChange={set('state')}
            invalid={!!errors['state']}
            autoComplete="address-level1"
          >
            <option value="">Select state…</option>
            {US_STATES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field
          label="ZIP"
          required
          error={errors['zip']}
          hint="Format: 90210 or 90210-1234"
          className="md:col-span-2"
        >
          <TextInput
            placeholder="90210"
            value={state.zip}
            onChange={set('zip')}
            invalid={!!errors['zip']}
            inputMode="numeric"
            maxLength={10}
            autoComplete="postal-code"
            className="md:max-w-xs"
          />
        </Field>
      </div>
    </div>
  );
}
