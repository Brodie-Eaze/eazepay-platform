'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Check } from '../_components/icons';
import { ctaPrimary } from '../_components/primitives';

const FIELD =
  'w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-[15px] text-fg placeholder:text-fg-muted outline-none transition-colors focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/20';
const LABEL = 'mb-1.5 block text-[13px] font-semibold text-fg';

export function BookForm() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    // No backend wired yet, fall back to opening the user's mail client with a
    // pre-filled request so nothing is lost. Replace with a CRM/endpoint POST.
    const body = [
      `Name: ${data.get('name') || ''}`,
      `Work email: ${data.get('email') || ''}`,
      `Company: ${data.get('company') || ''}`,
      `Phone: ${data.get('phone') || ''}`,
      `Monthly volume: ${data.get('volume') || ''}`,
      '',
      `${data.get('message') || ''}`,
    ].join('\n');
    try {
      window.location.href = `mailto:support@eazepay.com?subject=${encodeURIComponent(
        'Book a call, ' + (data.get('company') || data.get('name') || 'New request'),
      )}&body=${encodeURIComponent(body)}`;
    } catch {
      /* ignore */
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="ez-card flex flex-col items-center rounded-2xl border border-border bg-bg-elevated p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-sky/10 text-brand-sky">
          <Check size={26} />
        </span>
        <h2 className="mt-5 text-[22px] font-bold tracking-tight text-fg">Request received.</h2>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-fg-secondary">
          Thanks, a member of the EazePay Inc. team will reach out within one business day to book
          your call. If your mail client didn&apos;t open, email us directly at{' '}
          <a
            href="mailto:support@eazepay.com"
            className="font-semibold text-brand-sky no-underline"
          >
            support@eazepay.com
          </a>
          .
        </p>
        <a href="/" className="mt-6 text-[14px] font-semibold text-brand-sky no-underline">
          ← Back to home
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="ez-card rounded-2xl border border-border bg-bg-elevated p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="name">
            Full name
          </label>
          <input id="name" name="name" required className={FIELD} placeholder="Jane Smith" />
        </div>
        <div>
          <label className={LABEL} htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={FIELD}
            placeholder="jane@company.com"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="company">
            Company
          </label>
          <input
            id="company"
            name="company"
            required
            className={FIELD}
            placeholder="Company Inc."
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="phone">
            Phone <span className="font-normal text-fg-muted">(optional)</span>
          </label>
          <input id="phone" name="phone" className={FIELD} placeholder="(555) 555-5555" />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="volume">
            Estimated monthly volume <span className="font-normal text-fg-muted">(optional)</span>
          </label>
          <select id="volume" name="volume" className={FIELD} defaultValue="">
            <option value="" disabled>
              Select a range
            </option>
            <option>Under $100k / mo</option>
            <option>$100k, $500k / mo</option>
            <option>$500k, $2M / mo</option>
            <option>$2M+ / mo</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="message">
            What are you building?
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            className={`${FIELD} resize-none`}
            placeholder="Tell us about your brand, vertical and what you'd like to launch."
          />
        </div>
      </div>

      <button type="submit" className={`${ctaPrimary} mt-6 w-full sm:w-auto`}>
        Request a call
        <ArrowRight size={16} />
      </button>
      <p className="mt-4 text-[12.5px] leading-relaxed text-fg-muted">
        By submitting, you agree to EazePay Inc.&apos;s{' '}
        <a href="/privacy" className="text-brand-sky no-underline">
          Privacy Policy
        </a>{' '}
        and{' '}
        <a href="/terms" className="text-brand-sky no-underline">
          Terms of Service
        </a>
        . We&apos;ll only use your details to contact you about EazePay.
      </p>
    </form>
  );
}
