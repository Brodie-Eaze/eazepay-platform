'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Configurable smart-routing showcase. Smart routing can branch on financial
 * data, on form answers, or any mix — so this renders multiple CONFIGS as tabs:
 *   1. Credit → Income (sequential financial gates)
 *   2. Score + Intent (parallel score, then a form-question gate)
 *   3. Question-based (route purely on form answers, 3 outcomes)
 * One lead at a time walks the active config; each stage activates, the taken
 * branch lights up, a pulse travels it. Tabs are clickable + auto-advance.
 */

const VB = { w: 1000, h: 500 };

type Kind = 'stage' | 'decision' | 'leaf';
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
  verb?: string; // leaf tally verb
};
type Edge = { from: string; to: string; label?: string };
type Intent = 'hot' | 'warm' | 'cold';
type Lead = {
  id: string;
  amt: string;
  src: string;
  dot: Intent;
  path: string[];
  decisions?: Record<string, { text: string; pass: boolean }>;
  scores?: Array<{ k: string; v: string }>;
};
type Config = {
  id: string;
  label: string;
  blurb: string;
  nodes: NodeT[];
  edges: Edge[];
  leads: Lead[];
};

const SOURCES = [
  { id: 's1', x: 40, y: 158, label: 'Meta' },
  { id: 's2', x: 40, y: 250, label: 'Google' },
  { id: 's3', x: 40, y: 342, label: 'TikTok' },
];

const CONFIGS: Config[] = [
  // ── 1 · sequential financial gates ─────────────────────────────
  {
    id: 'credit-income',
    label: 'Credit → Income',
    blurb: 'Sequential financial gates — credit first, then income.',
    nodes: [
      {
        id: 'capture',
        x: 158,
        y: 250,
        w: 148,
        code: 'SMART FORM',
        title: 'Capture',
        sub: 'any funnel · any source',
        kind: 'stage',
      },
      {
        id: 'intel',
        x: 336,
        y: 250,
        w: 176,
        code: 'INTELLIGENCE',
        title: 'Financial data',
        sub: 'soft pull · under 2s',
        kind: 'stage',
        scores: true,
      },
      {
        id: 'credit',
        x: 510,
        y: 250,
        w: 146,
        code: 'DECISION · 1',
        title: 'Credit score',
        sub: 'threshold 680',
        kind: 'decision',
      },
      {
        id: 'income',
        x: 686,
        y: 166,
        w: 146,
        code: 'DECISION · 2',
        title: 'Income',
        sub: 'high vs low',
        kind: 'decision',
      },
      {
        id: 'vsl',
        x: 876,
        y: 108,
        w: 176,
        code: 'HIGH-TICKET VSL',
        title: 'Book a call',
        sub: "closer's calendar · 1:1",
        kind: 'leaf',
        book: true,
        verb: 'booked',
      },
      {
        id: 'slo',
        x: 876,
        y: 392,
        w: 176,
        code: 'SLO FUNNEL',
        title: 'Self-liquidating offer',
        sub: 'low-ticket · instant',
        kind: 'leaf',
        verb: 'entered',
      },
    ],
    edges: [
      { from: 'capture', to: 'intel' },
      { from: 'intel', to: 'credit' },
      { from: 'credit', to: 'income', label: '≥ 680' },
      { from: 'credit', to: 'slo', label: '< 680' },
      { from: 'income', to: 'vsl', label: 'high' },
      { from: 'income', to: 'slo', label: 'low' },
    ],
    leads: [
      {
        id: 'L-8419',
        amt: '$72,400',
        src: 'Meta',
        dot: 'hot',
        path: ['capture', 'intel', 'credit', 'income', 'vsl'],
        scores: [
          { k: 'credit', v: '748' },
          { k: 'income', v: '$14.2k/mo' },
          { k: 'avail', v: '$61k' },
        ],
        decisions: {
          credit: { text: '748 ✓ ≥680', pass: true },
          income: { text: '$14.2k ✓ high', pass: true },
        },
      },
      {
        id: 'L-8421',
        amt: '$9,400',
        src: 'TikTok',
        dot: 'warm',
        path: ['capture', 'intel', 'credit', 'income', 'slo'],
        scores: [
          { k: 'credit', v: '712' },
          { k: 'income', v: '$6.1k/mo' },
          { k: 'avail', v: '$22k' },
        ],
        decisions: {
          credit: { text: '712 ✓ ≥680', pass: true },
          income: { text: '$6.1k ✗ low', pass: false },
        },
      },
      {
        id: 'L-8417',
        amt: '$2,300',
        src: 'Google',
        dot: 'cold',
        path: ['capture', 'intel', 'credit', 'slo'],
        scores: [
          { k: 'credit', v: '642' },
          { k: 'income', v: '$4.8k/mo' },
          { k: 'avail', v: '$5k' },
        ],
        decisions: { credit: { text: '642 ✗ <680', pass: false } },
      },
    ],
  },
  // ── 2 · parallel score, then a form-question gate ──────────────
  {
    id: 'score-intent',
    label: 'Score + Intent',
    blurb: 'Score credit + income in parallel, then route on a form question.',
    nodes: [
      {
        id: 'capture',
        x: 158,
        y: 250,
        w: 148,
        code: 'SMART FORM',
        title: 'Capture',
        sub: 'any funnel · any source',
        kind: 'stage',
      },
      {
        id: 'score',
        x: 340,
        y: 250,
        w: 180,
        code: 'INTELLIGENCE',
        title: 'Score',
        sub: 'credit + income · parallel',
        kind: 'stage',
        scores: true,
      },
      {
        id: 'qualify',
        x: 516,
        y: 250,
        w: 150,
        code: 'DECISION · 1',
        title: 'Qualified?',
        sub: 'fundable on paper',
        kind: 'decision',
      },
      {
        id: 'intent',
        x: 690,
        y: 166,
        w: 156,
        code: 'DECISION · 2',
        title: 'Intent',
        sub: '“ready to start?”',
        kind: 'decision',
      },
      {
        id: 'book',
        x: 878,
        y: 108,
        w: 176,
        code: 'BOOK A CALL',
        title: 'Closer track',
        sub: 'high-intent · 1:1',
        kind: 'leaf',
        book: true,
        verb: 'booked',
      },
      {
        id: 'slo',
        x: 878,
        y: 392,
        w: 176,
        code: 'SLO FUNNEL',
        title: 'Self-liquidating offer',
        sub: 'nurture · instant',
        kind: 'leaf',
        verb: 'entered',
      },
    ],
    edges: [
      { from: 'capture', to: 'score' },
      { from: 'score', to: 'qualify' },
      { from: 'qualify', to: 'intent', label: 'pass' },
      { from: 'qualify', to: 'slo', label: 'decline' },
      { from: 'intent', to: 'book', label: 'now' },
      { from: 'intent', to: 'slo', label: 'later' },
    ],
    leads: [
      {
        id: 'L-9003',
        amt: '$68,000',
        src: 'Meta',
        dot: 'hot',
        path: ['capture', 'score', 'qualify', 'intent', 'book'],
        scores: [
          { k: 'credit', v: '751' },
          { k: 'income', v: '$13.4k/mo' },
        ],
        decisions: {
          qualify: { text: 'fundable ✓', pass: true },
          intent: { text: '“Now” ✓ ready', pass: true },
        },
      },
      {
        id: 'L-9007',
        amt: '$11,200',
        src: 'Google',
        dot: 'warm',
        path: ['capture', 'score', 'qualify', 'intent', 'slo'],
        scores: [
          { k: 'credit', v: '706' },
          { k: 'income', v: '$7.0k/mo' },
        ],
        decisions: {
          qualify: { text: 'fundable ✓', pass: true },
          intent: { text: '“Exploring” ✗', pass: false },
        },
      },
      {
        id: 'L-9011',
        amt: '$1,900',
        src: 'TikTok',
        dot: 'cold',
        path: ['capture', 'score', 'qualify', 'slo'],
        scores: [
          { k: 'credit', v: '634' },
          { k: 'income', v: '$4.2k/mo' },
        ],
        decisions: { qualify: { text: 'thin file ✗', pass: false } },
      },
    ],
  },
  // ── 3 · pure question-based routing, 3 outcomes ────────────────
  {
    id: 'question-based',
    label: 'Question-based',
    blurb: 'No financials — route purely on the answers the form collects.',
    nodes: [
      {
        id: 'capture',
        x: 168,
        y: 250,
        w: 150,
        code: 'SMART FORM',
        title: 'Questions',
        sub: 'goal · budget · timeline',
        kind: 'stage',
      },
      {
        id: 'answers',
        x: 360,
        y: 250,
        w: 182,
        code: 'ANSWERS',
        title: 'Form answers',
        sub: 'captured live',
        kind: 'stage',
        scores: true,
      },
      {
        id: 'route',
        x: 552,
        y: 250,
        w: 150,
        code: 'SMART ROUTING',
        title: 'Route on answers',
        sub: 'rules you set',
        kind: 'decision',
      },
      {
        id: 'book',
        x: 884,
        y: 110,
        w: 176,
        code: 'BOOK A CALL',
        title: 'High-ticket call',
        sub: 'closer · 1:1',
        kind: 'leaf',
        book: true,
        verb: 'booked',
      },
      {
        id: 'slo',
        x: 884,
        y: 250,
        w: 176,
        code: 'SLO OFFER',
        title: 'Self-liquidating offer',
        sub: 'instant checkout',
        kind: 'leaf',
        verb: 'sold',
      },
      {
        id: 'nurture',
        x: 884,
        y: 390,
        w: 176,
        code: 'NURTURE',
        title: 'Email nurture',
        sub: 'long-cycle',
        kind: 'leaf',
        verb: 'added',
      },
    ],
    edges: [
      { from: 'capture', to: 'answers' },
      { from: 'answers', to: 'route' },
      { from: 'route', to: 'book', label: 'high intent' },
      { from: 'route', to: 'slo', label: 'mid' },
      { from: 'route', to: 'nurture', label: 'low' },
    ],
    leads: [
      {
        id: 'L-7700',
        amt: '$50k+',
        src: 'Meta',
        dot: 'hot',
        path: ['capture', 'answers', 'route', 'book'],
        scores: [
          { k: 'goal', v: 'Scale' },
          { k: 'budget', v: '$50k+' },
          { k: 'when', v: 'ASAP' },
        ],
        decisions: { route: { text: '$50k+ · buy now → call', pass: true } },
      },
      {
        id: 'L-7704',
        amt: '$5–15k',
        src: 'Google',
        dot: 'warm',
        path: ['capture', 'answers', 'route', 'slo'],
        scores: [
          { k: 'goal', v: 'Test' },
          { k: 'budget', v: '$5–15k' },
          { k: 'when', v: '30 days' },
        ],
        decisions: { route: { text: 'mid budget → SLO', pass: true } },
      },
      {
        id: 'L-7709',
        amt: 'TBD',
        src: 'TikTok',
        dot: 'cold',
        path: ['capture', 'answers', 'route', 'nurture'],
        scores: [
          { k: 'goal', v: 'Learn' },
          { k: 'budget', v: 'TBD' },
          { k: 'when', v: '—' },
        ],
        decisions: { route: { text: 'researching → nurture', pass: false } },
      },
    ],
  },
];

// smooth right-edge → left-edge connector between two nodes
function edgePath(a: NodeT, b: NodeT): string {
  const x1 = a.x + a.w / 2;
  const y1 = a.y;
  const x2 = b.x - b.w / 2;
  const y2 = b.y;
  const dx = (x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}
function midpoint(a: NodeT, b: NodeT): { x: number; y: number } {
  const x1 = a.x + a.w / 2;
  const x2 = b.x - b.w / 2;
  return { x: (x1 + x2) / 2, y: (a.y + b.y) / 2 };
}

const ALL_LEAVES = CONFIGS.flatMap((c) =>
  c.nodes.filter((n) => n.kind === 'leaf').map((n) => n.id),
);
const INIT_COUNTS: Record<string, number> = Object.fromEntries(
  ALL_LEAVES.map((id, i) => [id, 60 + ((i * 37) % 90)]),
);

export function RoutingTree() {
  const [configIdx, setConfigIdx] = useState(0);
  const [leadIdx, setLeadIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>(INIT_COUNTS);
  const counted = useRef(false);

  const cfg = CONFIGS[configIdx]!;
  const nodeBy: Record<string, NodeT> = Object.fromEntries(cfg.nodes.map((n) => [n.id, n]));
  const lead = cfg.leads[leadIdx]!;
  const path = lead.path;
  const last = path.length - 1;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout>;
    if (step < last) {
      t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 1100 : 1350);
    } else {
      t = setTimeout(() => {
        counted.current = false;
        setStep(0);
        if (leadIdx < cfg.leads.length - 1) {
          setLeadIdx((i) => i + 1);
        } else {
          setLeadIdx(0);
          setConfigIdx((c) => (c + 1) % CONFIGS.length);
        }
      }, 2200);
    }
    return () => clearTimeout(t);
  }, [step, leadIdx, configIdx, reduce, last, cfg.leads.length]);

  useEffect(() => {
    if (step === last && !counted.current) {
      counted.current = true;
      const term = path[last]!;
      setCounts((c) => ({ ...c, [term]: (c[term] ?? 0) + 1 }));
    }
  }, [step, leadIdx, configIdx, last, path]);

  function pickConfig(i: number) {
    if (i === configIdx) return;
    counted.current = false;
    setConfigIdx(i);
    setLeadIdx(0);
    setStep(0);
  }

  const activeId = path[step]!;
  const reached = (id: string) => path.slice(0, step + 1).includes(id);
  const isLit = (e: Edge) => {
    for (let i = 0; i < step; i++) if (path[i] === e.from && path[i + 1] === e.to) return true;
    return false;
  };
  const activeEdge =
    step > 0 ? cfg.edges.find((e) => e.from === path[step - 1] && e.to === path[step]) : undefined;

  const bookedTotal = cfg.nodes
    .filter((n) => n.kind === 'leaf' && n.book)
    .reduce((s, n) => s + (counts[n.id] ?? 0), 0);

  function narrate(): string {
    const n = nodeBy[activeId];
    if (!n) return '';
    if (n.id === 'capture') return `New lead from ${lead.src} · ${lead.amt}`;
    if (n.kind === 'leaf') return `${n.book ? 'Booked' : 'Routed'} · ${n.title}`;
    if (n.kind === 'decision' && lead.decisions?.[n.id])
      return `${n.title} · ${lead.decisions[n.id]!.text}`;
    return `Reading · ${n.title.toLowerCase()}`;
  }

  return (
    <div className="ez-tree-frame">
      <div className="ez-tree-frame__top">
        <span className="ez-tree-live">
          <span className="ez-live-dot" aria-hidden />
          Live routing
        </span>
        <span className={`ez-tree-lead ez-tree-lead--${lead.dot}`} key={`${configIdx}-${leadIdx}`}>
          <span className="ez-tree-lead__dot" aria-hidden />
          {lead.id} · {lead.amt}
        </span>
        <span className="ez-tree-narrate" key={`${configIdx}-${leadIdx}-${step}`}>
          {narrate()}
        </span>
        <span className="ez-tree-stat">{bookedTotal} booked today</span>
      </div>

      {/* configuration tabs */}
      <div className="ez-cfg-tabs" role="tablist">
        {CONFIGS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={i === configIdx}
            className={`ez-cfg-tab${i === configIdx ? ' ez-cfg-tab--active' : ''}`}
            onClick={() => pickConfig(i)}
          >
            {c.label}
          </button>
        ))}
        <span className="ez-cfg-blurb">{cfg.blurb}</span>
      </div>

      <div className="ez-tree" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
        <div className="ez-tree__glow" aria-hidden />

        <svg
          className="ez-tree__svg"
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {SOURCES.map((s) => (
            <path
              key={`src-${s.id}`}
              className="ez-tedge ez-tedge--src"
              d={`M${s.x + 26},${s.y} C118,${s.y} 118,250 ${cfg.nodes[0]!.x - cfg.nodes[0]!.w / 2},250`}
            />
          ))}

          {cfg.edges.map((e) => (
            <path
              key={`base-${e.from}-${e.to}`}
              className="ez-tedge"
              d={edgePath(nodeBy[e.from]!, nodeBy[e.to]!)}
            />
          ))}
          {cfg.edges.map((e) =>
            isLit(e) ? (
              <g key={`lit-${e.from}-${e.to}`}>
                <path
                  className="ez-tedge ez-tedge--litglow"
                  d={edgePath(nodeBy[e.from]!, nodeBy[e.to]!)}
                />
                <path
                  className="ez-tedge ez-tedge--lit"
                  d={edgePath(nodeBy[e.from]!, nodeBy[e.to]!)}
                />
              </g>
            ) : null,
          )}

          {activeEdge && (
            <circle key={`pulse-${configIdx}-${leadIdx}-${step}`} className="ez-pulse" r={4}>
              <animateMotion
                dur="0.85s"
                begin="0s"
                fill="freeze"
                path={edgePath(nodeBy[activeEdge.from]!, nodeBy[activeEdge.to]!)}
              />
              <animate
                attributeName="opacity"
                dur="0.85s"
                begin="0s"
                fill="freeze"
                values="0;1;1;0"
                keyTimes="0;0.2;0.7;1"
              />
            </circle>
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

        {cfg.edges
          .filter((e) => e.label)
          .map((e) => {
            const m = midpoint(nodeBy[e.from]!, nodeBy[e.to]!);
            return (
              <div
                key={`chip-${e.from}-${e.to}`}
                className={`ez-edge-chip${isLit(e) ? ' ez-edge-chip--lit' : ''}`}
                style={
                  { left: `${(m.x / VB.w) * 100}%`, top: `${(m.y / VB.h) * 100}%` } as CSSProperties
                }
              >
                {e.label}
              </div>
            );
          })}

        {cfg.nodes.map((n) => {
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
          const decision =
            n.kind === 'decision' && reached(n.id) ? lead.decisions?.[n.id] : undefined;
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

                {n.scores && reached(n.id) && lead.scores && (
                  <div className="ez-tnode__scores" key={`${configIdx}-${leadIdx}`}>
                    {lead.scores.map((s, si) => (
                      <span
                        key={s.k}
                        className="ez-tnode__score ez-score-in"
                        style={{ animationDelay: `${si * 0.14}s` } as CSSProperties}
                      >
                        {s.k} {s.v}
                      </span>
                    ))}
                  </div>
                )}

                {decision && (
                  <span
                    className={`ez-decide ${decision.pass ? 'ez-decide--yes' : 'ez-decide--no'}`}
                  >
                    {decision.text}
                  </span>
                )}

                {n.kind === 'leaf' && (
                  <span className="ez-tnode__tally">
                    <span className="ez-tnode__tally-dot" aria-hidden />
                    {n.verb ?? 'routed'} · <span className="tabular-nums">{counts[n.id] ?? 0}</span>
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
