import type { CSSProperties } from 'react';
import { Check, LogoMark } from './icons';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

const POINTS = [
  'Soft-pull underwriting — credit, income and DTI in seconds',
  'Lender-marketplace waterfall · best offer by total cost of credit',
  'Zero credit impact · no hit to the applicant’s score',
  'Merchant-direct payout · 48–72hr · no intermediary float',
];

/** The soft-pull underwriting factors rendered on the phone. */
const CHECKS: Array<{ label: string; value: string }> = [
  { label: 'Credit score', value: '712' },
  { label: 'Income', value: '$8,200/mo' },
  { label: 'DTI', value: '34%' },
  { label: 'Identity', value: 'verified' },
];

/** Three best-fit offers (winner first) — representative, mirrors the marketplace. */
const OFFERS: Array<{ name: string; rate: string; fill: number; win?: boolean }> = [
  { name: 'Cross River Bank', rate: '5.9%', fill: 0.95, win: true },
  { name: 'FinWise', rate: '6.9%', fill: 0.78 },
  { name: 'Alpine Credit', rate: '7.2%', fill: 0.71 },
];

export function DealScope() {
  return (
    <section id="console" className="relative overflow-hidden bg-bg py-24">
      <Container className="grid items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
        {/* ---- copy column ---- */}
        <Reveal>
          <Eyebrow>On the merchant&apos;s phone</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
            A deal lands — and <span className="ez-sky-text">approves itself.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-fg-secondary">
            This is the EazePay merchant console. A live application is scored on a soft pull —
            credit, income and DTI — then waterfalls across the lender marketplace in parallel,
            matched and approved in seconds and settled merchant-direct. Every vertical brand sees
            the same screen, skinned.
          </p>
          <ul className="mt-7 space-y-3">
            {POINTS.map((t) => (
              <li key={t} className="flex items-center gap-3 text-[14px] text-fg-secondary">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-sky/10 text-brand-sky">
                  <Check size={13} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        {/* ---- phone column ---- */}
        <Reveal delay={90} className="ez-phone-stage relative">
          <div className="ez-phone" aria-hidden>
            <span className="ez-phone__island" />
            <span className="ez-phone__btn ez-phone__btn--mute" />
            <span className="ez-phone__btn ez-phone__btn--vol-up" />
            <span className="ez-phone__btn ez-phone__btn--vol-dn" />
            <span className="ez-phone__btn ez-phone__btn--power" />

            <div className="ez-phone__screen">
              {/* status bar */}
              <div className="flex items-center justify-between px-6 pb-1 pt-3.5 text-[11px] font-semibold text-brand-ink-soft">
                <span className="tabular-nums">9:41</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[9px] tracking-tight">5G</span>
                  <span className="inline-flex h-[11px] w-[20px] items-center rounded-[3px] border border-brand-ink-soft/50 p-[1.5px]">
                    <span className="block h-full w-[72%] rounded-[1px] bg-brand-ink-soft" />
                  </span>
                </span>
              </div>

              {/* app header */}
              <div className="flex items-center justify-between border-b border-black/5 px-4 pb-3 pt-1.5">
                <div className="flex items-center gap-2">
                  <span className="ez-logo-tile grid h-6 w-6 place-items-center rounded-md text-white">
                    <LogoMark size={13} />
                  </span>
                  <span className="text-[12.5px] font-bold tracking-tight text-fg">EazePay</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-sky/10 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] text-brand-sky-deep">
                  <span className="ez-live-dot" style={{ width: 6, height: 6 }} />
                  LIVE
                </span>
              </div>

              {/* body */}
              <div className="flex-1 space-y-3 overflow-hidden px-4 py-3">
                {/* deal card */}
                <div className="rounded-xl border border-black/[0.06] bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-sky-wash text-[12px] font-bold text-brand-sky-deep">
                      SM
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold leading-tight text-fg">Sarah M.</div>
                      <div className="text-[10.5px] text-fg-muted">MedPay · Dental implants</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-bold leading-tight tabular-nums text-fg">
                        $12,400
                      </div>
                      <div className="font-mono text-[9.5px] text-fg-muted">L-8423</div>
                    </div>
                  </div>
                </div>

                {/* soft-pull underwriting factors */}
                <div>
                  <div className="mb-2 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                    Soft-pull check
                  </div>
                  <div className="relative">
                    <span className="ez-step-rail" />
                    <ul className="space-y-2">
                      {CHECKS.map((c) => (
                        <li key={c.label} className="flex items-center gap-2.5">
                          <span className="ez-step-dot">
                            <Check size={11} />
                          </span>
                          <span className="text-[11px] font-semibold text-fg">{c.label}</span>
                          <span className="ml-auto text-[11px] font-bold tabular-nums text-fg">
                            {c.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* best offers */}
                <div>
                  <div className="mb-2 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                    Best offers · soft pull
                  </div>
                  <div className="space-y-2">
                    {OFFERS.map((o, i) => (
                      <div
                        key={o.name}
                        className={
                          o.win
                            ? 'rounded-lg border border-brand-sky/30 bg-brand-sky-wash/70 p-2'
                            : 'rounded-lg border border-black/[0.05] bg-white p-2'
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-fg">
                            {o.name}
                            {o.win && (
                              <span className="rounded-full bg-brand-sky px-1.5 py-[1px] text-[8px] font-bold tracking-wide text-white">
                                BEST
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[11px] font-bold tabular-nums text-fg">
                            {o.rate}
                          </span>
                        </div>
                        <div className="ez-pf-bar mt-1.5">
                          <span
                            style={
                              {
                                '--wf': o.fill,
                                '--wd': `${(i * 0.14).toFixed(2)}s`,
                              } as CSSProperties
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* approve-itself banner pinned to the bottom */}
              <div className="px-4 pb-4 pt-1">
                <div className="ez-appr">
                  <div className="ez-appr__pending">
                    <span className="text-[11px] font-semibold">Selecting best offer…</span>
                    <span className="ez-appr__indet" />
                  </div>
                  <div className="ez-appr__done">
                    <Check size={15} />
                    <span className="text-[12px] font-bold">Approved</span>
                    <span className="ml-auto font-mono text-[10px] font-semibold">
                      5.9% APR · 48–72hr
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
