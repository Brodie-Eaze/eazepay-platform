import { AGENTS } from '../data';
import { Container, Eyebrow, cx } from './primitives';
import { Reveal } from './Reveal';

/** ONLINE = sky (pulsing). LEARNING = amber (a deliberate status accent). */
function StatusBadge({ status }: { status: 'ONLINE' | 'LEARNING' }) {
  const online = status === 'ONLINE';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em]"
      style={
        online
          ? {
              borderColor: 'rgb(61 111 229 / 0.4)',
              color: 'rgb(37 78 184)',
              background: 'rgb(61 111 229 / 0.08)',
            }
          : {
              borderColor: 'rgb(201 138 60 / 0.42)',
              color: 'rgb(166 108 38)',
              background: 'rgb(201 138 60 / 0.1)',
            }
      }
    >
      {online ? (
        <span className="ez-live-dot" aria-hidden />
      ) : (
        <span
          aria-hidden
          style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgb(201 138 60)' }}
        />
      )}
      {status}
    </span>
  );
}

export function Agents() {
  return (
    <section id="agents" className="bg-bg py-24">
      <Container>
        <Reveal className="max-w-3xl">
          <Eyebrow>The agentic layer</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-fg sm:text-[42px]">
            Seven agents, bundled. <span className="ez-sky-text">No separate AI stack.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-fg-secondary">
            PRISM, VEGA, ORACLE, HELIX, NEXUS, FLUX and ECHO ship in the same signup as the
            financing marketplace. Each has one job, a measurable output and an immutable,
            FCRA-aware audit trail. This is the live console.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {AGENTS.map((a, i) => (
            <Reveal
              key={a.code}
              delay={(i % 3) * 80}
              className={cx('h-full', a.wide && 'lg:col-span-3')}
            >
              <div
                className={cx(
                  'ez-card flex h-full flex-col rounded-2xl border border-border bg-bg-elevated p-6',
                  a.wide && 'lg:flex-row lg:items-center lg:gap-10',
                )}
              >
                <div className={cx('min-w-0', a.wide ? 'lg:max-w-md' : 'flex-1')}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[12px] font-semibold text-fg-muted">{a.n}</span>
                      <span className="text-[15px] font-bold tracking-tight text-fg">{a.code}</span>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-1 text-[12.5px] font-semibold text-brand-sky">{a.role}</div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-fg-secondary">
                    {a.description}
                  </p>
                </div>

                <div className={cx('mt-5', a.wide && 'lg:mt-0 lg:flex-1')}>
                  <div className="grid grid-cols-2 gap-3">
                    {a.stats.map((s) => (
                      <div key={s.k} className="rounded-xl border border-border bg-bg p-3">
                        <div className="text-[10.5px] font-medium uppercase tracking-wide text-fg-muted">
                          {s.k}
                        </div>
                        <div className="mt-1 text-[17px] font-bold text-fg tabular-nums">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-ink px-3 py-2.5">
                    <span className="ez-live-dot mt-1.5 shrink-0" aria-hidden />
                    <span className="block text-[11px] leading-relaxed text-brand-sky-soft">
                      {a.lastAction}
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
