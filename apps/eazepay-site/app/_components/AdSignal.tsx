import type { CSSProperties } from 'react';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

const POINTS: Array<{ b: string; t: string }> = [
  {
    b: 'Server side CAPI',
    t: 'with deduplication keys, so Meta sees one clean event, not two.',
  },
  {
    b: 'Offline conversions',
    t: 'uploaded when the deal actually closes, the strongest signal you can send back.',
  },
  {
    b: 'Tier weighted events',
    t: 'push a higher value score for your best leads, lower for the rest.',
  },
];

/** Deterministic pixel heatmap: 'off' suppressed, 'on' qualified, 'hot' high value. */
const CELLS = Array.from({ length: 84 }, (_, i) => {
  const v = (i * 73 + 17) % 100;
  return v < 13 ? 'hot' : v < 33 ? 'on' : 'off';
});

export function AdSignal() {
  return (
    <section id="ad-signal" className="ez-dark ez-section-join relative overflow-hidden py-24">
      <div className="ez-grid-floor" aria-hidden />
      <Container className="relative z-[2] grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        {/* ---- copy ---- */}
        <Reveal>
          <Eyebrow>Qualified pixel firing</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-[42px]">
            Train your ads on buyers, <span className="ez-gradient-text">not form fillers.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-white/65">
            Most funnels fire a conversion the second a form is submitted, so your pixel learns from
            everyone. EazePay holds that signal until the lead clears prequalification, then fires a
            clean, weighted event back to Meta and Google with the financial data behind it. Your
            bidding starts optimizing for real buyers, so cost per quality lead comes down over
            time.
          </p>
          <ul className="mt-7 space-y-4">
            {POINTS.map((p) => (
              <li key={p.b} className="flex gap-3 text-[14px] leading-relaxed text-white/80">
                <span className="ez-live-dot mt-1.5 shrink-0" aria-hidden />
                <span>
                  <strong className="font-semibold text-white">{p.b}</strong> {p.t}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* ---- pixel heatmap ---- */}
        <Reveal delay={90}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/50">
                Pixel events · last 1,000 leads
              </span>
              <div className="flex items-center gap-4 text-[11px] text-white/55">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-brand-sky-soft" aria-hidden />
                  fired (qualified)
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-[3px] border border-white/15 bg-white/5"
                    aria-hidden
                  />
                  suppressed
                </span>
              </div>
            </div>

            <div className="ez-pixel-grid mt-5">
              {CELLS.map((s, i) => (
                <span
                  key={i}
                  className={`ez-pixel-cell${s === 'on' ? ' ez-pixel-cell--on' : s === 'hot' ? ' ez-pixel-cell--hot' : ''}`}
                  style={{ '--pd': `${(i % 12) * 0.06}s` } as CSSProperties}
                  aria-hidden
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10">
              {[
                { k: 'Submitted', v: '1,000' },
                { k: 'Qualified · fired', v: '312' },
                { k: 'Suppressed', v: '688' },
              ].map((s) => (
                <div key={s.k} className="bg-brand-ink px-4 py-4">
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/45">
                    {s.k}
                  </div>
                  <div className="mt-1.5 text-[22px] font-bold tabular-nums text-white">{s.v}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-white/40">
              Representative view. Only qualified leads fire a conversion event, so the ad platform
              optimizes toward buyers, not form fills.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
