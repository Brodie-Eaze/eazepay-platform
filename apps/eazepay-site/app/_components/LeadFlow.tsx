import type { CSSProperties } from 'react';
import { FLOW_NODES, LIVE_LEADS, FLOW_FORK, FLOW_OUTCOMES } from '../data';
import { FLOW_ICON } from './icons';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

/**
 * The centerpiece: one smart form → smart routing pipeline with live leads
 * flowing left-to-right along the rail (capture → score → route → quote → settle),
 * then the binary fork + four leaf outcomes beneath. Pure-CSS motion.
 */
export function LeadFlow() {
  return (
    <section id="flow" className="ez-dark relative overflow-hidden py-24">
      <div className="ez-grid-floor" aria-hidden />

      <Container className="relative z-[2]">
        <Reveal className="max-w-3xl">
          <Eyebrow>Smart form · built for sales teams</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-[42px]">
            One smart form, <span className="ez-gradient-text">wired to the whole rail.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-white/65">
            Drop the EazePay smart form into any funnel your sales team runs. Every submission flows
            the same path — captured, qualified on credit and intent in under two seconds, then
            routed: high-ticket buyers land straight on a closer's calendar, everyone else drops
            into the right nurture or starter offer. Each chip below is the same lead moving left to
            right — live.
          </p>
        </Reveal>

        {/* intent legend */}
        <Reveal className="mt-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-white/55">
            <span className="flex items-center gap-2">
              <span className="ez-lead__dot ez-lead__dot--hot" aria-hidden />
              High intent
            </span>
            <span className="flex items-center gap-2">
              <span className="ez-lead__dot ez-lead__dot--warm" aria-hidden />
              Warm
            </span>
            <span className="flex items-center gap-2">
              <span className="ez-lead__dot ez-lead__dot--cold" aria-hidden />
              Low intent
            </span>
          </div>
        </Reveal>

        {/* the animated pipeline */}
        <Reveal className="mt-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
            <div className="ez-pipe">
              <span className="ez-pipe__rail" aria-hidden />

              {LIVE_LEADS.map((lead) => (
                <span
                  key={lead.id}
                  className="ez-lead"
                  style={{ '--ld': lead.delay } as CSSProperties}
                  aria-hidden
                >
                  <span className={`ez-lead__dot ez-lead__dot--${lead.intent}`} />
                  {lead.id}
                  <span className="text-white/55">{lead.amount}</span>
                </span>
              ))}

              {FLOW_NODES.map((node) => {
                const Icon = FLOW_ICON[node.icon];
                return (
                  <div key={node.code} className="ez-stage items-center text-center">
                    <span className="ez-pnode__ico" aria-hidden>
                      <Icon size={18} />
                    </span>
                    <div className="ez-pnode w-full">
                      <div className="font-mono text-[10.5px] font-semibold tracking-[0.1em] text-brand-sky-soft">
                        {node.code}
                      </div>
                      <div className="mt-1.5 text-[15px] font-semibold text-white">
                        {node.title}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-white/50">{node.sub}</div>
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-brand-ink/50 px-2.5 py-1 text-[10.5px] font-medium text-white/70">
                        <span className="ez-live-dot" aria-hidden />
                        {node.live}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* the binary fork + four leaf outcomes */}
        <Reveal className="mt-12">
          <div className="flex items-center gap-3">
            <span className="ez-eyebrow text-brand-sky-soft">After the score · a binary fork</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">
            Smart routing splits on ticket size and intent — a high-ticket path and a low-ticket
            path, each resolving to the right offer. Same rail, four clean outcomes.
          </p>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {FLOW_FORK.map((fork, fi) => (
              <div
                key={fork.code}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="font-mono text-[12px] font-semibold tracking-[0.08em] text-brand-sky-soft">
                  {fork.code}
                </div>
                <p className="mt-1 text-[12.5px] text-white/50">{fork.label}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {FLOW_OUTCOMES.slice(fi * 2, fi * 2 + 2).map((o) => (
                    <div
                      key={o.label}
                      className="rounded-xl border border-white/10 bg-brand-ink/40 p-3.5"
                    >
                      <div className="text-[12.5px] font-semibold text-white">{o.label}</div>
                      <div className="mt-0.5 text-[11px] text-white/45">{o.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
