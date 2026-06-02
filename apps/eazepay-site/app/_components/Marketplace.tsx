import type { CSSProperties } from 'react';
import { LENDERS } from '../data';
import { Check } from './icons';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

const POINTS = [
  'Soft pull only · zero credit impact',
  'Three best-fit offers ranked by total cost of credit',
  'Lender carries the credit risk · no clawback on routine defaults',
  'Merchant-direct disbursement · 48–72hr to your account',
];

export function Marketplace() {
  return (
    <section id="marketplace" className="ez-dark relative overflow-hidden py-24">
      <Container className="relative z-[2] grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <Eyebrow>The financing marketplace</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-[42px]">
            Every lender. One waterfall. <span className="ez-gradient-text">Best offer wins.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-white/65">
            Every application waterfalls through a curated lender marketplace — prime to near-prime
            — in parallel. NEXUS ranks the three best offers by total cost of credit on a soft pull.
            The lender on the winning offer disburses merchant-direct in 48–72 hours.
          </p>
          <ul className="mt-7 space-y-3">
            {POINTS.map((t) => (
              <li key={t} className="flex items-center gap-3 text-[14px] text-white/80">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-sky/20 text-brand-sky-soft">
                  <Check size={13} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={90}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/50">
              <span>Lender</span>
              <span>Parallel quote · APR from</span>
            </div>
            <div className="mt-4 space-y-4">
              {LENDERS.map((l, i) => (
                <div key={l.name}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13.5px] font-semibold text-white">{l.name}</span>
                      <span
                        className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.06em]"
                        style={
                          l.tier === 'PRIME'
                            ? { borderColor: 'rgb(124 162 246 / 0.45)', color: 'rgb(124 162 246)' }
                            : { borderColor: 'rgb(201 138 60 / 0.45)', color: 'rgb(214 154 76)' }
                        }
                      >
                        {l.tier}
                      </span>
                    </div>
                    <span className="font-mono text-[13px] font-semibold tabular-nums text-white">
                      {l.rate}
                    </span>
                  </div>
                  <div className="ez-wf__bar mt-2">
                    <span
                      style={
                        { '--wf': l.fill, '--wd': `${(i * 0.16).toFixed(2)}s` } as CSSProperties
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[11.5px] leading-relaxed text-white/40">
              Representative panel — lender names and rates are illustrative of the marketplace, not
              a published offer. Soft pull only; final APR is set by the lender.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
