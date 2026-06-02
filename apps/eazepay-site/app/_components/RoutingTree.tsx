'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Guided smart-routing walkthrough. One lead at a time is driven through the
 * pipeline by a small state machine: Capture → Qualify (scores reveal) →
 * Route (the chosen branch lights up) → Match → Booked (leaf counter ticks).
 * Each stage activates as the lead arrives, so the routing logic narrates
 * itself. Then the next lead routes a different way. Reduced-motion shows a
 * settled end-state. The token glides between nodes via a CSS transition.
 */

const VB = { w: 1000, h: 540 };

type Kind = 'stage' | 'match' | 'leaf';
type LeafId = 'bookP' | 'slo' | 'lowoff' | 'bookS';
type NodeT = {
  id: string;
  x: number;
  y: number;
  w: number;
  code: string;
  title: string;
  sub: string;
  kind: Kind;
  book?: boolean;
};

const NODES: NodeT[] = [
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
    w: 176,
    code: 'SMART CHECK',
    title: 'Qualify',
    sub: 'soft pull · under 2s',
    kind: 'stage',
  },
  {
    id: 'route',
    x: 540,
    y: 270,
    w: 150,
    code: 'SMART ROUTING',
    title: 'Route',
    sub: 'ticket size + intent',
    kind: 'stage',
  },
  {
    id: 'hmatch',
    x: 700,
    y: 150,
    w: 146,
    code: 'HIGH-TICKET',
    title: 'Premium VSL',
    sub: 'closer track',
    kind: 'match',
  },
  {
    id: 'lmatch',
    x: 700,
    y: 392,
    w: 146,
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
    code: "CLOSER'S CALENDAR",
    title: '1:1 with a closer',
    sub: 'high-ticket · booked',
    kind: 'leaf',
    book: true,
  },
  {
    id: 'slo',
    x: 892,
    y: 214,
    w: 168,
    code: 'PRIORITY CALLBACK',
    title: 'Closer follow-up',
    sub: 'high-intent · queued',
    kind: 'leaf',
  },
  {
    id: 'lowoff',
    x: 892,
    y: 326,
    w: 168,
    code: 'SELF-SERVE OFFER',
    title: 'Starter offer',
    sub: 'instant · $97–$497',
    kind: 'leaf',
  },
  {
    id: 'bookS',
    x: 892,
    y: 448,
    w: 168,
    code: 'TEAM CALENDAR',
    title: 'Group call',
    sub: 'low-ticket · booked',
    kind: 'leaf',
    book: true,
  },
];
const NODE_BY_ID: Record<string, NodeT> = Object.fromEntries(NODES.map((n) => [n.id, n]));

type Edge = { from: string; to: string; d: string };
const EDGES: Edge[] = [
  { from: 'form', to: 'qualify', d: 'M150,270 L348,270' },
  { from: 'qualify', to: 'route', d: 'M348,270 L540,270' },
  { from: 'route', to: 'hmatch', d: 'M540,270 C616,270 624,150 700,150' },
  { from: 'route', to: 'lmatch', d: 'M540,270 C616,270 624,392 700,392' },
  { from: 'hmatch', to: 'bookP', d: 'M700,150 C800,150 792,92 892,92' },
  { from: 'hmatch', to: 'slo', d: 'M700,150 C800,150 792,214 892,214' },
  { from: 'lmatch', to: 'lowoff', d: 'M700,392 C800,392 792,326 892,326' },
  { from: 'lmatch', to: 'bookS', d: 'M700,392 C800,392 792,448 892,448' },
];

const SOURCES = [
  { id: 's1', x: 40, y: 196, label: 'Meta' },
  { id: 's2', x: 40, y: 270, label: 'Google' },
  { id: 's3', x: 40, y: 344, label: 'TikTok' },
];

type Intent = 'hot' | 'warm' | 'cold';
type Lead = {
  id: string;
  amt: string;
  intent: Intent;
  src: string;
  tag: string;
  scores: Array<{ k: string; v: string }>;
  branch: 'high' | 'low';
  leaf: LeafId;
  outcome: string;
};

// Routing rule: ticket size + intent decide the branch.
//   HIGH ticket  → closer track → 1:1 closer's calendar / priority callback.
//   LOW  ticket  → nurture track → TEAM calendar (group call) OR self-serve offer.
// The team calendar is ONLY ever reached by low-ticket leads.
const LEADS: Lead[] = [
  {
    id: 'L-8419',
    amt: '$72,400',
    intent: 'hot',
    src: 'Meta',
    tag: 'High intent',
    scores: [
      { k: 'credit', v: '748' },
      { k: 'income', v: '$14.2k/mo' },
      { k: 'avail', v: '$61k' },
    ],
    branch: 'high',
    leaf: 'bookP',
    outcome: "closer's calendar",
  },
  {
    id: 'L-8421',
    amt: '$41,000',
    intent: 'hot',
    src: 'TikTok',
    tag: 'High intent',
    scores: [
      { k: 'credit', v: '712' },
      { k: 'income', v: '$9.4k/mo' },
      { k: 'avail', v: '$38k' },
    ],
    branch: 'high',
    leaf: 'slo',
    outcome: 'closer follow-up',
  },
  {
    id: 'L-8417',
    amt: '$5,800',
    intent: 'warm',
    src: 'Google',
    tag: 'Low ticket',
    scores: [
      { k: 'credit', v: '690' },
      { k: 'income', v: '$6.1k/mo' },
      { k: 'avail', v: '$14k' },
    ],
    branch: 'low',
    leaf: 'bookS',
    outcome: 'team calendar',
  },
  {
    id: 'L-8416',
    amt: '$1,200',
    intent: 'cold',
    src: 'Meta',
    tag: 'Low ticket',
    scores: [
      { k: 'credit', v: 'past-due' },
      { k: 'income', v: '$3.2k/mo' },
      { k: 'avail', v: '$2k' },
    ],
    branch: 'low',
    leaf: 'lowoff',
    outcome: 'self-serve offer',
  },
];

const STEP_MS = [1000, 1500, 1500, 1200, 1900]; // capture, qualify, route, match, booked(hold)

function stageNodeId(step: number, lead: Lead): string {
  return ['form', 'qualify', 'route', lead.branch === 'high' ? 'hmatch' : 'lmatch', lead.leaf][
    step
  ] as string;
}

// the four edges a lead traverses, in order
function pathEdges(lead: Lead): Array<[string, string]> {
  const match = lead.branch === 'high' ? 'hmatch' : 'lmatch';
  return [
    ['form', 'qualify'],
    ['qualify', 'route'],
    ['route', match],
    [match, lead.leaf],
  ];
}

const NARRATION: Array<(l: Lead) => string> = [
  (l) => `New lead from ${l.src} · ${l.amt}`,
  (l) => `Soft-pull qualify · ${l.scores[0]!.v} credit · ${l.scores[1]!.v}`,
  (l) => `Routing · ${l.branch === 'high' ? 'high-ticket' : 'low-ticket'} · ${l.amt}`,
  (l) => `Matched · ${l.branch === 'high' ? 'Premium VSL' : 'Fast VSL'}`,
  (l) => `${l.leaf === 'bookP' || l.leaf === 'bookS' ? 'Booked' : 'Routed'} · ${l.outcome}`,
];

const INIT_COUNTS: Record<LeafId, number> = { bookP: 31, slo: 17, lowoff: 142, bookS: 48 };

export function RoutingTree() {
  const [leadIdx, setLeadIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [counts, setCounts] = useState<Record<LeafId, number>>(INIT_COUNTS);
  const counted = useRef(false);

  const lead = LEADS[leadIdx]!;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // drive the state machine
  useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout>;
    if (step < 4) {
      t = setTimeout(() => setStep((s) => s + 1), STEP_MS[step]);
    } else {
      t = setTimeout(() => {
        setLeadIdx((i) => (i + 1) % LEADS.length);
        setStep(0);
        counted.current = false;
      }, STEP_MS[4]);
    }
    return () => clearTimeout(t);
  }, [step, leadIdx, reduce]);

  // tick the leaf counter exactly once, when the lead books
  useEffect(() => {
    if (step === 4 && !counted.current) {
      counted.current = true;
      setCounts((c) => ({ ...c, [lead.leaf]: c[lead.leaf] + 1 }));
    }
  }, [step, lead.leaf]);

  const activeId = stageNodeId(step, lead);
  const token = NODE_BY_ID[activeId];
  const litEdges = pathEdges(lead).slice(0, Math.max(0, step)); // edges traversed so far
  const isLit = (e: Edge) => litEdges.some(([f, t]) => f === e.from && t === e.to);
  const totalBooked = counts.bookP + counts.bookS;

  return (
    <div className="ez-tree-frame">
      <div className="ez-tree-frame__top">
        <span className="ez-tree-live">
          <span className="ez-live-dot" aria-hidden />
          Live routing
        </span>
        <span className="ez-tree-narrate" key={`${leadIdx}-${step}`}>
          {NARRATION[step]!(lead)}
        </span>
        <span className="ez-tree-stat">
          {totalBooked} calls booked today · <span className="text-white/80">0 dropped</span>
        </span>
      </div>

      <div className="ez-tree" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
        <div className="ez-tree__glow" aria-hidden />

        <svg
          className="ez-tree__svg"
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <filter id="ezGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {SOURCES.map((s) => (
            <path
              key={`src-${s.id}`}
              className="ez-tedge ez-tedge--src"
              d={`M${s.x + 28},${s.y} C110,${s.y} 110,270 150,270`}
            />
          ))}

          {EDGES.map((e) => (
            <path key={`base-${e.from}-${e.to}`} className="ez-tedge" d={e.d} />
          ))}
          {EDGES.map((e) =>
            isLit(e) ? (
              <path
                key={`lit-${e.from}-${e.to}`}
                className="ez-tedge ez-tedge--lit"
                d={e.d}
                filter="url(#ezGlow)"
              />
            ) : null,
          )}
        </svg>

        {SOURCES.map((s) => (
          <div
            key={s.id}
            className={`ez-tsrc${s.label === lead.src && step === 0 ? ' ez-tsrc--on' : ''}`}
            style={
              { left: `${(s.x / VB.w) * 100}%`, top: `${(s.y / VB.h) * 100}%` } as CSSProperties
            }
          >
            <span className="ez-tsrc__dot" aria-hidden />
            {s.label}
          </div>
        ))}

        {NODES.map((n) => {
          const active = n.id === activeId;
          const isLeaf = n.kind === 'leaf';
          const cls = [
            'ez-tnode',
            n.kind === 'match' ? 'ez-tnode--match' : '',
            isLeaf ? 'ez-tnode--leaf' : '',
            n.book ? 'ez-tnode--book' : '',
            n.id === 'route' ? 'ez-tnode--hub' : '',
            active ? 'ez-tnode--active' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
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
              <div className={cls}>
                <div className="ez-tnode__code">{n.code}</div>
                <div className="ez-tnode__title">{n.title}</div>
                <div className="ez-tnode__sub">{n.sub}</div>

                {n.id === 'qualify' && step >= 1 && (
                  <div className="ez-tnode__scores" key={leadIdx}>
                    {lead.scores.map((s, si) => (
                      <span
                        key={s.k}
                        className="ez-tnode__score ez-score-in"
                        style={{ animationDelay: `${si * 0.16}s` } as CSSProperties}
                      >
                        {s.k} {s.v}
                      </span>
                    ))}
                  </div>
                )}

                {isLeaf && (
                  <span className="ez-tnode__tally">
                    <span className="ez-tnode__tally-dot" aria-hidden />
                    {n.book ? 'booked' : n.id === 'lowoff' ? 'checkout' : 'queued'} ·{' '}
                    <span className="tabular-nums">{counts[n.id as LeafId]}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* the single guided lead, gliding node → node */}
        {token && (
          <div
            className={`ez-demo-tok ez-demo-tok--${lead.intent}${step === 4 ? ' ez-demo-tok--done' : ''}`}
            style={
              {
                left: `${(token.x / VB.w) * 100}%`,
                top: `${((token.y - 44) / VB.h) * 100}%`,
              } as CSSProperties
            }
          >
            <span className="ez-demo-tok__dot" aria-hidden />
            {lead.id}
            <span className="ez-demo-tok__amt">{lead.amt}</span>
          </div>
        )}
      </div>
    </div>
  );
}
