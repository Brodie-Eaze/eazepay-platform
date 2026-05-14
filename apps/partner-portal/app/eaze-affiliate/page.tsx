'use client';
import { useState } from 'react';
import {
  SparkIcon,
  CheckIcon,
  ChartIcon,
  UsersIcon,
  ArrowRightIcon,
  PackageIcon,
} from '@eazepay/ui/web';

/**
 * EAZE Affiliate — direct port of the Lovable `/eaze-affiliate` page.
 * Powered by Impact. Layout:
 *
 *   eyebrow + name
 *   ┌──── intro card ────┐
 *   │ icon · heading      │
 *   │ body                │
 *   ├──── 2 stats ───────┤
 *   │ Commission 1% | Payout Cycle Monthly │
 *   ├──── 3 features ────┤
 *   │ Multi-Channel / Performance Tiers / Dedicated Support │
 *   ├──── 3 details ─────┤
 *   │ Competitive / Real-Time / Custom Links │
 *   ├──── benefits ──────┤
 *   ├──── apply form ────┤
 *   └────────────────────┘
 */

export default function EazeAffiliatePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/integrations/affiliate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      }).catch(() => undefined);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-8 py-6 max-w-3xl">
      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
        Integration
      </p>
      <h1 className="mt-1 text-fg">EAZE Affiliate</h1>

      <div className="mt-4 rounded-xl border border-border bg-bg-elevated">
        <div className="p-6">
          <div className="h-12 w-12 rounded-xl bg-[#0d1530] text-white flex items-center justify-center">
            <SparkIcon size={22} />
          </div>
          <h2 className="mt-5 text-[18px] font-semibold tracking-tight text-fg">
            EAZE Affiliate Program
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-secondary max-w-2xl">
            Join our affiliate network powered by Impact and earn commissions by referring
            businesses to EAZE&apos;s suite of financial products. Get real-time tracking,
            dedicated support, and competitive payouts.
          </p>
        </div>

        <div className="grid grid-cols-2 border-t border-border">
          <Stat label="Commission" value="1%" />
          <Stat label="Payout Cycle" value="Monthly" />
        </div>

        <div className="grid grid-cols-3 border-t border-border">
          <Feature icon={<ChartIcon size={18} />} title="Multi-Channel" desc="Share via social, email, website, or content" />
          <Feature icon={<SparkIcon size={18} />} title="Performance Tiers" desc="Unlock higher commissions as you scale" />
          <Feature icon={<UsersIcon size={18} />} title="Dedicated Support" desc="Access to affiliate manager and resources" last />
        </div>

        <div className="grid grid-cols-3 border-t border-border">
          <Feature
            icon={<PackageIcon size={18} />}
            title="Competitive Commissions"
            desc="Earn recurring revenue on every funded deal referred through your unique affiliate link"
            bottom
          />
          <Feature
            icon={<ChartIcon size={18} />}
            title="Real-Time Tracking"
            desc="Monitor clicks, conversions, and payouts with Impact's powerful analytics dashboard"
            bottom
          />
          <Feature
            icon={<ArrowRightIcon size={18} />}
            title="Custom Tracking Links"
            desc="Generate branded referral links and promotional assets for your audience"
            last
            bottom
          />
        </div>

        <div className="border-t border-border p-6">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-3">
            Program Benefits
          </p>
          <ul className="space-y-2">
            {[
              '1% commission on settled deals',
              'No cap on earnings',
              'Monthly payouts via direct deposit',
              'Access to creative assets and banners',
              "Real-time reporting via Impact dashboard",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[13px] text-fg-secondary">
                <span className="h-4 w-4 rounded-full border border-border text-fg flex items-center justify-center shrink-0 mt-0.5">
                  <CheckIcon size={10} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Apply form */}
        <div className="border-t border-border p-6">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-3">
            Apply to Join
          </p>
          {done ? (
            <div className="rounded-md border border-border bg-bg-muted px-3 py-2 text-[13px] text-fg flex items-center gap-2">
              <CheckIcon size={14} />
              Application received — our affiliate team will be in touch within 2 business days.
            </div>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                placeholder="Full Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-lg border border-border bg-bg-elevated px-3.5 text-[14px] outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20"
              />
              <input
                required
                type="email"
                placeholder="Email Address *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg border border-border bg-bg-elevated px-3.5 text-[14px] outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20"
              />
              <input
                required
                type="tel"
                placeholder="Phone Number *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 rounded-lg border border-border bg-bg-elevated px-3.5 text-[14px] outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20"
              />
              <button
                type="submit"
                disabled={submitting}
                className="md:col-span-3 h-11 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-[#1a2a52] disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Apply Now'}
                {!submitting && <ArrowRightIcon size={14} />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 border-r border-border last:border-r-0">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className="mt-1.5 text-[22px] font-bold tracking-tight text-fg">{value}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
  last,
  bottom,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  last?: boolean;
  bottom?: boolean;
}) {
  return (
    <div
      className={
        'p-5 ' +
        (last ? '' : 'border-r border-border ') +
        (bottom ? '' : 'border-b border-border')
      }
    >
      <span className="text-fg-muted block mb-2">{icon}</span>
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">{desc}</p>
    </div>
  );
}
