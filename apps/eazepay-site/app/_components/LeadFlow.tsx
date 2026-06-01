import type { CSSProperties } from 'react';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

/**
 * The smart-routing TREE. One connected branching flow: a live lead is
 * captured, scored on real financial data, routed at the fork, then travels
 * down the high-ticket or low-ticket branch all the way to a booked call /
 * offer. Leads animate root → leaf along their actual path (SMIL motion),
 * the branch they take is decided by ticket size + intent. Pure SVG + CSS.
 */

const VB = { w: 1000, h: 540 };

type Kind = 'stage' | 'match' | 'leaf';
type Node = {
  id: string;
  x: number;
  y: number;
  w: number;
  code: string;
  title: string;
  sub: string;
  kind: Kind;
  book?: boolean;
  score?: string[];
};

const NODES: Node[] = [
  {
    id: 'form',
    x: 82,
    y: 270,
    w: 156,
    code: 'SMART FORM',
    title: 'Capture',
    sub: 'any funnel · any source',
    kind: 'stage',
  },
  {
    id: 'qualify',
    x: 296,
    y: 270,
    w: 178,
    code: 'SMART CHECK',
    title: 'Qualify',
    sub: 'soft pull · under 2s',
    kind: 'stage',
    score: ['credit 712', 'income $8.2k/mo', 'avail $41k'],
  },
  {
    id: 'route',
    x: 500,
    y: 270,
    w: 156,
    code: 'SMART ROUTING',
    title: 'Route',
    sub: 'ticket size + intent',
    kind: 'stage',
  },
  {
    id: 'hmatch',
    x: 668,
    y: 150,
    w: 150,
    code: 'HIGH-TICKET',
    title: 'Premium VSL',
    sub: 'closer track',
    kind: 'match',
  },
  {
    id: 'lmatch',
    x: 668,
    y: 392,
    w: 150,
    code: 'LOW-TICKET',
    title: 'Fast VSL',
    sub: 'nurture track',
    kind: 'match',
  },
  {
    id: 'bookP',
    x: 880,
    y: 92,
    w: 170,
    code: 'BOOK A CALL · PREMIUM',
    title: "Closer's calendar",
    sub: 'high-intent · booked live',
    kind: 'leaf',
    book: true,
  },
  {
    id: 'slo',
    x: 880,
    y: 214,
    w: 170,
    code: 'SLO',
    title: 'Self-liquidating offer',
    sub: 'instant · funds the ads',
    kind: 'leaf',
  },
  {
    id: 'lowoff',
    x: 880,
    y: 326,
    w: 170,
    code: 'LOW-TICKET OFFER',
    title: 'Starter offer',
    sub: 'instant checkout · $97–$497',
    kind: 'leaf',
  },
  {
    id: 'bookS',
    x: 880,
    y: 448,
    w: 170,
    code: 'BOOK A CALL · STANDARD',
    title: 'Group call',
    sub: 'warm pipeline · booked',
    kind: 'leaf',
    book: true,
  },
];

// Tree edges (faint base + an animated dashed overlay that shows flow direction).
const EDGES: string[] = [
  'M82,270 L296,270',
  'M296,270 L500,270',
  'M500,270 C586,270 582,150 668,150',
  'M500,270 C586,270 582,392 668,392',
  'M668,150 C772,150 776,92 880,92',
  'M668,150 C772,150 776,214 880,214',
  'M668,392 C772,392 776,326 880,326',
  'M668,392 C772,392 776,448 880,448',
];

type Intent = 'hot' | 'warm' | 'cold';
type Lead = { id: string; amt: string; intent: Intent; d: string; begin: string };

const TRUNK = 'M82,270 L296,270 L500,270';
// Each lead's full root→leaf path. The branch it takes IS the routing decision:
// high ticket + high intent → closer's calendar; warm/low → nurture + offer.
const LEADS: Lead[] = [
  {
    id: 'L-8419',
    amt: '$72,400',
    intent: 'hot',
    d: `${TRUNK} C586,270 582,150 668,150 C772,150 776,92 880,92`,
    begin: '0s',
  },
  {
    id: 'L-8421',
    amt: '$48,000',
    intent: 'hot',
    d: `${TRUNK} C586,270 582,150 668,150 C772,150 776,214 880,214`,
    begin: '1.7s',
  },
  {
    id: 'L-8418',
    amt: '$12,400',
    intent: 'warm',
    d: `${TRUNK} C586,270 582,392 668,392 C772,392 776,448 880,448`,
    begin: '3.4s',
  },
  {
    id: 'L-8417',
    amt: '$5,800',
    intent: 'warm',
    d: `${TRUNK} C586,270 582,392 668,392 C772,392 776,326 880,326`,
    begin: '5.1s',
  },
  {
    id: 'L-8416',
    amt: '$1,200',
    intent: 'cold',
    d: `${TRUNK} C586,270 582,392 668,392 C772,392 776,326 880,326`,
    begin: '6.8s',
  },
];

const DUR = 8.4;

function cardClass(n: Node): string {
  if (n.kind === 'match') return 'ez-tnode ez-tnode--match';
  if (n.kind === 'leaf') return `ez-tnode ez-tnode--leaf${n.book ? ' ez-tnode--book' : ''}`;
  return 'ez-tnode ez-tnode--stage';
}

export function LeadFlow() {
  return (
    <section id="flow" className="ez-dark relative overflow-hidden py-24">
      <div className="ez-grid-floor" aria-hidden />

      <Container className="relative z-[2]">
        <Reveal className="max-w-3xl">
          <Eyebrow>Smart routing · built for sales teams</Eyebrow>
          <h2 className="mt-5 text-[32px] font-bold leading-[1.12] tracking-[-0.015em] text-white sm:text-[42px]">
            One smart form, <span className="ez-gradient-text">the whole tree of outcomes.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-white/65">
            Watch a real lead travel the entire rail — captured from any funnel, scored on credit,
            income and available credit in under two seconds, then routed by ticket size and intent.
            High-ticket buyers branch straight to a closer&apos;s calendar; everyone else flows down
            the nurture branch to the right offer. Each chip below is a live lead finding its leaf.
          </p>
        </Reveal>

        {/* intent legend */}
        <Reveal className="mt-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-white/55">
            <span className="flex items-center gap-2">
              <span className="ez-lead__dot ez-lead__dot--hot" aria-hidden />
              High intent · high ticket
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

        {/* the routing tree */}
        <Reveal className="mt-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-5">
            <div className="ez-tree" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
              {/* edges + travelling leads (SVG layer) */}
              <svg
                className="ez-tree__svg"
                viewBox={`0 0 ${VB.w} ${VB.h}`}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden
              >
                {EDGES.map((d, i) => (
                  <path key={`base-${i}`} className="ez-tedge" d={d} />
                ))}
                {EDGES.map((d, i) => (
                  <path key={`flow-${i}`} className="ez-tedge ez-tedge--flow" d={d} />
                ))}

                {LEADS.map((lead) => (
                  <g key={lead.id} className={`ez-ttok ez-ttok--${lead.intent}`}>
                    <rect
                      className="ez-ttok__pill"
                      x={-44}
                      y={-13}
                      width={88}
                      height={26}
                      rx={13}
                    />
                    <circle className="ez-ttok__dot" cx={-30} cy={0} r={4.5} />
                    <text className="ez-ttok__id" x={-20} y={4}>
                      {lead.id}
                    </text>
                    <animateMotion
                      dur={`${DUR}s`}
                      begin={lead.begin}
                      repeatCount="indefinite"
                      rotate="0"
                      path={lead.d}
                      calcMode="spline"
                      keyTimes="0;0.18;0.5;0.82;1"
                      keyPoints="0;0.18;0.5;0.82;1"
                      keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                    />
                    <animate
                      attributeName="opacity"
                      dur={`${DUR}s`}
                      begin={lead.begin}
                      repeatCount="indefinite"
                      values="0;1;1;1;0"
                      keyTimes="0;0.06;0.5;0.92;1"
                    />
                  </g>
                ))}
              </svg>

              {/* node cards (HTML overlay, positioned in the same coordinate space) */}
              {NODES.map((n) => (
                <div
                  key={n.id}
                  className="ez-tnode-pos"
                  style={
                    {
                      left: `${(n.x / VB.w) * 100}%`,
                      top: `${(n.y / VB.h) * 100}%`,
                      width: `${(n.w / VB.w) * 100}%`,
                    } as CSSProperties
                  }
                >
                  <div className={cardClass(n)}>
                    <div className="ez-tnode__code">{n.code}</div>
                    <div className="ez-tnode__title">{n.title}</div>
                    <div className="ez-tnode__sub">{n.sub}</div>
                    {n.score && (
                      <div className="ez-tnode__scores">
                        {n.score.map((s) => (
                          <span key={s} className="ez-tnode__score">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {n.book && (
                      <span className="ez-tnode__book">
                        <span className="ez-live-dot" aria-hidden />
                        booked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
