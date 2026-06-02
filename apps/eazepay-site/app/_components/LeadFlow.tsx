import type { CSSProperties } from 'react';
import { Container, Eyebrow } from './primitives';
import { Reveal } from './Reveal';

/**
 * The smart-routing TREE. One connected, living branching flow: a lead is
 * captured from a funnel, scored on real financial data, routed at the fork,
 * then travels down the high-ticket or low-ticket branch — along glowing
 * energy edges — all the way to a booked call / offer leaf, where a live
 * counter ticks. Leads animate root → leaf (SMIL) on their actual path; the
 * branch is decided by ticket size + intent. Pure SVG + CSS.
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
  tally?: string;
};

// far-left funnel sources feeding the capture node
const SOURCES: Array<{ id: string; x: number; y: number; label: string }> = [
  { id: 's1', x: 40, y: 196, label: 'Meta' },
  { id: 's2', x: 40, y: 270, label: 'Google' },
  { id: 's3', x: 40, y: 344, label: 'TikTok' },
];

const NODES: Node[] = [
  {
    id: 'form',
    x: 150,
    y: 270,
    w: 150,
    code: 'SMART FORM',
    title: 'Capture',
    sub: 'any funnel · any source',
    kind: 'stage',
  },
  {
    id: 'qualify',
    x: 348,
    y: 270,
    w: 172,
    code: 'SMART CHECK',
    title: 'Qualify',
    sub: 'soft pull · under 2s',
    kind: 'stage',
    score: ['credit 712', 'income $8.2k/mo', 'avail $41k'],
  },
  {
    id: 'route',
    x: 540,
    y: 270,
    w: 148,
    code: 'SMART ROUTING',
    title: 'Route',
    sub: 'ticket size + intent',
    kind: 'stage',
  },
  {
    id: 'hmatch',
    x: 700,
    y: 150,
    w: 144,
    code: 'HIGH-TICKET',
    title: 'Premium VSL',
    sub: 'closer track',
    kind: 'match',
  },
  {
    id: 'lmatch',
    x: 700,
    y: 392,
    w: 144,
    code: 'LOW-TICKET',
    title: 'Fast VSL',
    sub: 'nurture track',
    kind: 'match',
  },
  {
    id: 'bookP',
    x: 892,
    y: 92,
    w: 168,
    code: 'BOOK A CALL · PREMIUM',
    title: "Closer's calendar",
    sub: 'high-intent · live',
    kind: 'leaf',
    book: true,
    tally: 'booked · 23',
  },
  {
    id: 'slo',
    x: 892,
    y: 214,
    w: 168,
    code: 'SLO',
    title: 'Self-liquidating offer',
    sub: 'instant · funds the ads',
    kind: 'leaf',
    tally: 'sold · 64',
  },
  {
    id: 'lowoff',
    x: 892,
    y: 326,
    w: 168,
    code: 'LOW-TICKET OFFER',
    title: 'Starter offer',
    sub: 'instant checkout',
    kind: 'leaf',
    tally: 'checkout · 118',
  },
  {
    id: 'bookS',
    x: 892,
    y: 448,
    w: 168,
    code: 'BOOK A CALL · STANDARD',
    title: 'Group call',
    sub: 'warm pipeline',
    kind: 'leaf',
    book: true,
    tally: 'booked · 41',
  },
];

// Tree edges. `flow` flags the live (branch) edges that carry the glow.
const EDGES: Array<{ d: string; hot?: boolean }> = [
  { d: 'M150,270 L348,270' },
  { d: 'M348,270 L540,270' },
  { d: 'M540,270 C616,270 624,150 700,150', hot: true },
  { d: 'M540,270 C616,270 624,392 700,392' },
  { d: 'M700,150 C800,150 792,92 892,92', hot: true },
  { d: 'M700,150 C800,150 792,214 892,214', hot: true },
  { d: 'M700,392 C800,392 792,326 892,326' },
  { d: 'M700,392 C800,392 792,448 892,448' },
];

type Intent = 'hot' | 'warm' | 'cold';
type Lead = { id: string; amt: string; intent: Intent; d: string; begin: string };

const TRUNK = 'M150,270 L348,270 L540,270';
// Each lead's full root→leaf path. The branch IS the routing decision.
const LEADS: Lead[] = [
  {
    id: 'L-8419',
    amt: '$72,400',
    intent: 'hot',
    d: `${TRUNK} C616,270 624,150 700,150 C800,150 792,92 892,92`,
    begin: '0s',
  },
  {
    id: 'L-8421',
    amt: '$48,000',
    intent: 'hot',
    d: `${TRUNK} C616,270 624,150 700,150 C800,150 792,214 892,214`,
    begin: '1.6s',
  },
  {
    id: 'L-8418',
    amt: '$12,400',
    intent: 'warm',
    d: `${TRUNK} C616,270 624,392 700,392 C800,392 792,448 892,448`,
    begin: '3.2s',
  },
  {
    id: 'L-8417',
    amt: '$5,800',
    intent: 'warm',
    d: `${TRUNK} C616,270 624,392 700,392 C800,392 792,326 892,326`,
    begin: '4.8s',
  },
  {
    id: 'L-8416',
    amt: '$1,200',
    intent: 'cold',
    d: `${TRUNK} C616,270 624,392 700,392 C800,392 792,326 892,326`,
    begin: '6.4s',
  },
];

const DUR = 8;

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
            the nurture branch to the right offer. Each chip is a live lead finding its leaf.
          </p>
        </Reveal>

        {/* the routing tree */}
        <Reveal className="mt-9">
          <div className="ez-tree-frame">
            <div className="ez-tree-frame__top">
              <span className="ez-tree-live">
                <span className="ez-live-dot" aria-hidden />
                Live routing
              </span>
              <span className="ez-tree-stat">
                1,284 leads routed today · <span className="text-white/80">0 dropped</span>
              </span>
              <span className="ez-tree-legend">
                <span className="flex items-center gap-1.5">
                  <span className="ez-lead__dot ez-lead__dot--hot" aria-hidden /> High
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="ez-lead__dot ez-lead__dot--warm" aria-hidden /> Warm
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="ez-lead__dot ez-lead__dot--cold" aria-hidden /> Low
                </span>
              </span>
            </div>

            <div className="ez-tree" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
              <div className="ez-tree__glow" aria-hidden />

              {/* edges + travelling leads (SVG layer) */}
              <svg
                className="ez-tree__svg"
                viewBox={`0 0 ${VB.w} ${VB.h}`}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden
              >
                <defs>
                  <linearGradient id="ezEdge" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(124 162 246)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="rgb(160 192 255)" stopOpacity="0.6" />
                  </linearGradient>
                  <filter id="ezGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="2.4" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* source → capture feeders */}
                {SOURCES.map((s) => (
                  <path
                    key={`src-${s.id}`}
                    className="ez-tedge ez-tedge--src"
                    d={`M${s.x + 28},${s.y} C110,${s.y} 110,270 150,270`}
                  />
                ))}

                {/* base edges */}
                {EDGES.map((e, i) => (
                  <path key={`base-${i}`} className="ez-tedge" d={e.d} />
                ))}
                {/* glowing flow overlay */}
                {EDGES.map((e, i) => (
                  <path
                    key={`flow-${i}`}
                    className={`ez-tedge ez-tedge--flow${e.hot ? ' ez-tedge--hot' : ''}`}
                    d={e.d}
                    filter="url(#ezGlow)"
                    style={{ '--fd': `${(i % 4) * 0.22}s` } as CSSProperties}
                  />
                ))}

                {/* travelling leads */}
                {LEADS.map((lead) => (
                  <g
                    key={lead.id}
                    className={`ez-ttok ez-ttok--${lead.intent}`}
                    filter="url(#ezGlow)"
                  >
                    <rect
                      className="ez-ttok__pill"
                      x={-76}
                      y={-14}
                      width={152}
                      height={28}
                      rx={14}
                    />
                    <circle className="ez-ttok__dot" cx={-60} cy={0} r={4.5} />
                    <text className="ez-ttok__id" x={-49} y={4}>
                      {lead.id}
                    </text>
                    <text className="ez-ttok__amt" x={66} y={4} textAnchor="end">
                      {lead.amt}
                    </text>
                    <animateMotion
                      dur={`${DUR}s`}
                      begin={lead.begin}
                      repeatCount="indefinite"
                      rotate="0"
                      path={lead.d}
                      calcMode="spline"
                      keyTimes="0;0.2;0.52;0.82;1"
                      keyPoints="0;0.2;0.52;0.82;1"
                      keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
                    />
                    <animate
                      attributeName="opacity"
                      dur={`${DUR}s`}
                      begin={lead.begin}
                      repeatCount="indefinite"
                      values="0;1;1;1;0"
                      keyTimes="0;0.07;0.5;0.9;1"
                    />
                  </g>
                ))}
              </svg>

              {/* source labels */}
              {SOURCES.map((s) => (
                <div
                  key={s.id}
                  className="ez-tsrc"
                  style={
                    {
                      left: `${(s.x / VB.w) * 100}%`,
                      top: `${(s.y / VB.h) * 100}%`,
                    } as CSSProperties
                  }
                >
                  <span className="ez-tsrc__dot" aria-hidden />
                  {s.label}
                </div>
              ))}

              {/* node cards (HTML overlay, same coordinate space) */}
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
                    {n.tally && (
                      <span className="ez-tnode__tally">
                        <span className="ez-tnode__tally-dot" aria-hidden />
                        {n.tally}
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
