'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Guided smart-routing DECISION TREE — refined.
 *   Capture (smart form) → Intelligence (financial data) →
 *   DECISION 1 · credit  →  DECISION 2 · income  →
 *   SLO low-ticket funnel  OR  high-ticket VSL → book a call.
 *
 * Credit-first: thin credit short-circuits to SLO; good credit goes to the
 * income gate; income decides VSL vs SLO. One lead at a time activates each
 * stage; a sleek pulse travels the segment it just took; the lit path stays
 * crisp (no glow blob). State-machine driven; reduced-motion settles.
 */

const VB = { w: 1000, h: 520 };

type Kind = 'stage' | 'decision' | 'leaf';
type Term = 'vsl' | 'slo';
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
  scores?: boolean;
};

const NODES: NodeT[] = [
  {
    id: 'capture',
    x: 158,
    y: 250,
    w: 150,
    code: 'SMART FORM',
    title: 'Capture',
    sub: 'any funnel · any source',
    kind: 'stage',
  },
  {
    id: 'intel',
    x: 344,
    y: 250,
    w: 182,
    code: 'INTELLIGENCE',
    title: 'Financial data',
    sub: 'soft pull · under 2s',
    kind: 'stage',
    scores: true,
  },
  {
    id: 'credit',
    x: 520,
    y: 250,
    w: 150,
    code: 'DECISION · 1',
    title: 'Credit score',
    sub: 'threshold 680',
    kind: 'decision',
  },
  {
    id: 'income',
    x: 700,
    y: 162,
    w: 150,
    code: 'DECISION · 2',
    title: 'Income',
    sub: 'high vs low',
    kind: 'decision',
  },
  {
    id: 'vsl',
    x: 886,
    y: 106,
    w: 176,
    code: 'HIGH-TICKET VSL',
    title: 'Book a call',
    sub: "closer's calendar · 1:1",
    kind: 'leaf',
    book: true,
  },
  {
    id: 'slo',
    x: 886,
    y: 396,
    w: 176,
    code: 'SLO FUNNEL',
    title: 'Self-liquidating offer',
    sub: 'low-ticket · instant',
    kind: 'leaf',
  },
];
const NODE_BY_ID: Record<string, NodeT> = Object.fromEntries(NODES.map((n) => [n.id, n]));

type Edge = { from: string; to: string; d: string; label?: string; lx?: number; ly?: number };
const EDGES: Edge[] = [
  { from: 'capture', to: 'intel', d: 'M158,250 L344,250' },
  { from: 'intel', to: 'credit', d: 'M344,250 L520,250' },
  {
    from: 'credit',
    to: 'income',
    d: 'M520,250 C606,250 616,162 700,162',
    label: '≥ 680',
    lx: 612,
    ly: 196,
  },
  {
    from: 'credit',
    to: 'slo',
    d: 'M520,250 C614,250 648,396 886,396',
    label: '< 680',
    lx: 642,
    ly: 332,
  },
  {
    from: 'income',
    to: 'vsl',
    d: 'M700,162 C792,162 800,106 886,106',
    label: 'high',
    lx: 794,
    ly: 126,
  },
  {
    from: 'income',
    to: 'slo',
    d: 'M700,162 C794,188 812,396 886,396',
    label: 'low',
    lx: 806,
    ly: 288,
  },
];

const SOURCES = [
  { id: 's1', x: 42, y: 170, label: 'Meta' },
  { id: 's2', x: 42, y: 250, label: 'Google' },
  { id: 's3', x: 42, y: 330, label: 'TikTok' },
];

type Intent = 'hot' | 'warm' | 'cold';
type Lead = {
  id: string;
  amt: string;
  src: string;
  credit: number;
  income: string;
  avail: string;
  creditPass: boolean;
  incomePass: boolean;
  path: string[];
  dot: Intent;
};

const LEADS: Lead[] = [
  {
    id: 'L-8419',
    amt: '$72,400',
    src: 'Meta',
    credit: 748,
    income: '$14.2k/mo',
    avail: '$61k',
    creditPass: true,
    incomePass: true,
    path: ['capture', 'intel', 'credit', 'income', 'vsl'],
    dot: 'hot',
  },
  {
    id: 'L-8421',
    amt: '$9,400',
    src: 'TikTok',
    credit: 712,
    income: '$6.1k/mo',
    avail: '$22k',
    creditPass: true,
    incomePass: false,
    path: ['capture', 'intel', 'credit', 'income', 'slo'],
    dot: 'warm',
  },
  {
    id: 'L-8417',
    amt: '$2,300',
    src: 'Google',
    credit: 642,
    income: '$4.8k/mo',
    avail: '$5k',
    creditPass: false,
    incomePass: false,
    path: ['capture', 'intel', 'credit', 'slo'],
    dot: 'cold',
  },
  {
    id: 'L-8424',
    amt: '$54,000',
    src: 'Meta',
    credit: 769,
    income: '$11.8k/mo',
    avail: '$47k',
    creditPass: true,
    incomePass: true,
    path: ['capture', 'intel', 'credit', 'income', 'vsl'],
    dot: 'hot',
  },
];

function narrate(lead: Lead, nodeId: string): string {
  switch (nodeId) {
    case 'capture':
      return `New lead from ${lead.src}`;
    case 'intel':
      return `Pulling financial data · soft pull`;
    case 'credit':
      return `Credit ${lead.credit} · ${lead.creditPass ? 'qualified → income check' : 'below 680 → SLO'}`;
    case 'income':
      return `Income ${lead.income} · ${lead.incomePass ? 'high → high-ticket VSL' : 'low → SLO'}`;
    case 'vsl':
      return `Booked · 1:1 closer's calendar`;
    case 'slo':
      return `Routed · SLO low-ticket funnel`;
    default:
      return '';
  }
}

const INIT_COUNTS: Record<Term, number> = { vsl: 134, slo: 396 };

export function RoutingTree() {
  const [leadIdx, setLeadIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [counts, setCounts] = useState<Record<Term, number>>(INIT_COUNTS);
  const counted = useRef(false);

  const lead = LEADS[leadIdx]!;
  const path = lead.path;
  const last = path.length - 1;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout>;
    if (step < last) {
      t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 1100 : 1400);
    } else {
      t = setTimeout(() => {
        setLeadIdx((i) => (i + 1) % LEADS.length);
        setStep(0);
        counted.current = false;
      }, 2200);
    }
    return () => clearTimeout(t);
  }, [step, leadIdx, reduce, last]);

  useEffect(() => {
    if (step === last && !counted.current) {
      counted.current = true;
      const term = path[last] as Term;
      setCounts((c) => ({ ...c, [term]: c[term] + 1 }));
    }
  }, [step, leadIdx, last, path]);

  const activeId = path[step] as string;
  const reached = (id: string) => path.slice(0, step + 1).includes(id);
  const isLit = (e: Edge) => {
    for (let i = 0; i < step; i++) if (path[i] === e.from && path[i + 1] === e.to) return true;
    return false;
  };
  // the segment the lead just traversed (for the travelling pulse)
  const activeEdge =
    step > 0 ? EDGES.find((e) => e.from === path[step - 1] && e.to === path[step]) : undefined;

  return (
    <div className="ez-tree-frame">
      <div className="ez-tree-frame__top">
        <span className="ez-tree-live">
          <span className="ez-live-dot" aria-hidden />
          Live routing
        </span>
        <span className={`ez-tree-lead ez-tree-lead--${lead.dot}`} key={leadIdx}>
          <span className="ez-tree-lead__dot" aria-hidden />
          {lead.id} · {lead.amt}
        </span>
        <span className="ez-tree-narrate" key={`${leadIdx}-${step}`}>
          {narrate(lead, activeId)}
        </span>
        <span className="ez-tree-stat">
          {counts.vsl} booked · {counts.slo} nurtured
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
          {/* source → capture feeders */}
          {SOURCES.map((s) => (
            <path
              key={`src-${s.id}`}
              className="ez-tedge ez-tedge--src"
              d={`M${s.x + 26},${s.y} C118,${s.y} 118,250 158,250`}
            />
          ))}

          {/* base edges */}
          {EDGES.map((e) => (
            <path key={`base-${e.from}-${e.to}`} className="ez-tedge" d={e.d} />
          ))}

          {/* lit path: soft underglow + crisp core (no blob) */}
          {EDGES.map((e) =>
            isLit(e) ? (
              <g key={`lit-${e.from}-${e.to}`}>
                <path className="ez-tedge ez-tedge--litglow" d={e.d} />
                <path className="ez-tedge ez-tedge--lit" d={e.d} />
              </g>
            ) : null,
          )}

          {/* sleek pulse travelling the segment just taken */}
          {activeEdge && (
            <circle key={`pulse-${leadIdx}-${step}`} className="ez-pulse" r={4}>
              <animateMotion dur="0.9s" begin="0s" fill="freeze" path={activeEdge.d} />
              <animate
                attributeName="opacity"
                dur="0.9s"
                begin="0s"
                fill="freeze"
                values="0;1;1;0"
                keyTimes="0;0.2;0.7;1"
              />
            </circle>
          )}
        </svg>

        {/* sources */}
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

        {/* condition chips on the decision edges */}
        {EDGES.filter((e) => e.label).map((e) => (
          <div
            key={`chip-${e.from}-${e.to}`}
            className={`ez-edge-chip${isLit(e) ? ' ez-edge-chip--lit' : ''}`}
            style={
              { left: `${(e.lx! / VB.w) * 100}%`, top: `${(e.ly! / VB.h) * 100}%` } as CSSProperties
            }
          >
            {e.label}
          </div>
        ))}

        {/* node cards */}
        {NODES.map((n) => {
          const active = n.id === activeId;
          const cls = [
            'ez-tnode',
            n.kind === 'decision' ? 'ez-tnode--decision' : '',
            n.kind === 'leaf' ? 'ez-tnode--leaf' : '',
            n.book ? 'ez-tnode--book' : '',
            active ? 'ez-tnode--active' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const passed = reached(n.id);
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

                {n.scores && step >= 1 && (
                  <div className="ez-tnode__scores" key={leadIdx}>
                    {[
                      ['credit', String(lead.credit)],
                      ['income', lead.income],
                      ['avail', lead.avail],
                    ].map(([k, v], si) => (
                      <span
                        key={k}
                        className="ez-tnode__score ez-score-in"
                        style={{ animationDelay: `${si * 0.16}s` } as CSSProperties}
                      >
                        {k} {v}
                      </span>
                    ))}
                  </div>
                )}

                {n.id === 'credit' && passed && (
                  <span
                    className={`ez-decide ${lead.creditPass ? 'ez-decide--yes' : 'ez-decide--no'}`}
                  >
                    {lead.credit} {lead.creditPass ? '✓ ≥680' : '✗ <680'}
                  </span>
                )}
                {n.id === 'income' && passed && (
                  <span
                    className={`ez-decide ${lead.incomePass ? 'ez-decide--yes' : 'ez-decide--no'}`}
                  >
                    {lead.income} {lead.incomePass ? '✓ high' : '✗ low'}
                  </span>
                )}

                {n.kind === 'leaf' && (
                  <span className="ez-tnode__tally">
                    <span className="ez-tnode__tally-dot" aria-hidden />
                    {n.id === 'vsl' ? 'booked' : 'entered'} ·{' '}
                    <span className="tabular-nums">{counts[n.id as Term]}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
