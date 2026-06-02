import type { CSSProperties } from 'react';
import { Check, LogoMark } from './icons';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

const POINTS = [
  'Prequalified on a soft pull · credit, income and DTI in seconds',
  'Pre-approved offers ranked by best total cost of credit',
  'Zero credit impact · no hit to their score',
  'Funded fast once they accept · 48 to 72 hours',
];

/** The soft pull underwriting factors rendered on the phone. */
const CHECKS: Array<{ label: string; value: string }> = [
  { label: 'Credit score', value: '712' },
  { label: 'Income', value: '$8,200/mo' },
  { label: 'DTI', value: '34%' },
];

/** Three best fit offers (winner first), representative, mirrors the marketplace. */
const OFFERS: Array<{ name: string; rate: string; fill: number; win?: boolean }> = [
  { name: 'Lender 1', rate: '5.9%', fill: 0.95, win: true },
  { name: 'Lender 2', rate: '6.9%', fill: 0.78 },
  { name: 'Lender 3', rate: '7.2%', fill: 0.71 },
];

export function DealScope() {
  return (
    <section id="console" className="relative overflow-hidden bg-bg py-24">
      <Container className="grid items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
        {/* ---- copy column ---- */}
        <Reveal>
          <Eyebrow>On the customer&apos;s phone</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
            Pre-approved <span className="ez-sky-text">in seconds.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-fg-secondary">
            This is what your customer sees. They apply, get prequalified on a soft pull, credit,
            income and DTI, and see their pre-approved offers in seconds, with no hit to their
            credit. Every brand shows the same flow, skinned in its own look.
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
              <div className="ez-phone__statusbar flex items-center justify-between px-6 pb-1 pt-3.5 text-[11px] font-semibold text-brand-ink-soft">
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
              </div>

              {/* body */}
              <div className="flex-1 space-y-4 overflow-hidden px-4 py-4">
                {/* deal card */}
                <div className="ez-phone-card relative overflow-hidden rounded-2xl border border-black/[0.04] bg-white p-4">
                  <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-sky-deep via-brand-sky to-brand-sky-soft" />
                  <div className="flex items-center gap-3">
                    <span className="ez-phone-avatar grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-sky-deep to-brand-sky text-[12.5px] font-bold text-white">
                      SM
                    </span>
                    <div className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-fg">
                      Sarah M.
                    </div>
                    <div className="shrink-0 text-[19px] font-extrabold leading-none tracking-tight tabular-nums text-fg">
                      $12,400
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-2.5">
                    <span className="truncate text-[11px] font-medium text-fg-secondary">
                      MedPay · Dental implants
                    </span>
                    <span className="shrink-0 font-mono text-[10.5px] font-medium text-fg-muted">
                      L-8423
                    </span>
                  </div>
                </div>

                {/* soft pull underwriting factors */}
                <div>
                  <div className="mb-3 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                    Soft pull check
                  </div>
                  <div className="relative">
                    <span className="ez-step-rail" />
                    <ul className="space-y-3">
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
                  <div className="mb-3 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                    Pre-approved offers
                  </div>
                  <div className="space-y-2.5">
                    {OFFERS.map((o, i) => (
                      <div
                        key={o.name}
                        className={
                          o.win
                            ? 'ez-offer-win rounded-xl border border-brand-sky/40 bg-gradient-to-br from-brand-sky-wash to-white p-3'
                            : 'ez-offer rounded-xl border border-black/[0.04] bg-white p-3'
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-fg">
                            {o.name}
                            {o.win && (
                              <span className="rounded-full bg-gradient-to-r from-brand-sky-deep to-brand-sky px-1.5 py-[1.5px] text-[8px] font-bold uppercase tracking-wide text-white shadow-[0_2px_5px_-1px_rgb(60_110_220/0.6)]">
                                Best
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[12px] font-extrabold tabular-nums text-fg">
                            {o.rate}
                          </span>
                        </div>
                        <div className="ez-pf-bar mt-2">
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

              {/* pre-approved banner pinned to the bottom */}
              <div className="px-4 pb-4 pt-1">
                <div className="ez-appr">
                  <div className="ez-appr__pending">
                    <span className="text-[11px] font-semibold">Checking offers…</span>
                    <span className="ez-appr__indet" />
                  </div>
                  <div className="ez-appr__done">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/30">
                      <Check size={12} />
                    </span>
                    <span className="truncate text-[12px] font-bold">Pre-approved</span>
                    <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-[9.5px] font-semibold text-white/85">
                      5.9% APR · best offer
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
