'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { EZ_CHECK_COPY, EZ_CHECK_MODULES } from '../../../lib/ez-check-theme';

/* ============================================================================
   EZ Check · Sales Presentation
   Same visual language as /sales/medpay — scroll-snap deck, animated
   gradient mesh, 3D-tilted offer card, animated counters, agent-array
   visualization, scroll-triggered reveals, keyboard navigation — in
   the sky-blue / slate palette.
   ========================================================================== */

interface Slide {
  n: string;
  title: string;
  build: () => JSX.Element;
}

const SLIDES_RAW: Slide[] = [
  /* 01 — COVER */
  {
    n: '01',
    title: 'EZ Check',
    build: () => (
      <div className="sld-stack sld-stack-cover">
        <Reveal>
          <div className="sld-cover-mark">
            <span className="sld-cover-mark-l">EZ</span>
            <span className="sld-cover-mark-slash">/</span>
            <span className="sld-cover-mark-r">Check</span>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <h1 className="sld-cover-h1">
            <span className="grad-blue-deep">Fill your calendar</span>
            <br />
            <span className="grad-blue">with buyers,</span>{' '}
            <span className="grad-blue-deep">not form fillers.</span>
          </h1>
        </Reveal>
        <Reveal delay={280}>
          <p className="sld-cover-sub">
            Pre-qualification engine for any online business. Drop a widget into your funnel and
            ship qualified buyers — not form fillers — straight to your sales calendar.
          </p>
        </Reveal>
        <Reveal delay={420}>
          <div className="sld-cover-meta">
            <span>Confidential · pre-launch deck</span>
            <span className="sld-cover-meta-sep">·</span>
            <span>EazePay · 2026</span>
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 02 — AGENDA */
  {
    n: '02',
    title: 'Agenda',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Here&apos;s what we&apos;ll cover in the next 45 minutes
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Why the form is broken,</span>{' '}
            <span className="grad-blue">and what we ship instead.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <Agenda />
        </Reveal>
      </div>
    ),
  },

  /* 03 — WHAT IS EZ CHECK */
  {
    n: '03',
    title: 'What is EZ Check',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              What is EZ Check
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="sld-h1">
              <span className="grad-blue-deep">EZ Check is a</span>{' '}
              <span className="grad-blue">pre-qualification engine</span>{' '}
              <span className="grad-blue-deep">for online sales funnels.</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              One widget, three agents, one outcome — qualified buyers booked onto your
              closer&apos;s calendar within seconds of form submit. Form fillers never reach your
              sales team.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="sld-chips">
              <span className="sld-chip">Soft-pull FCRA · 0 impact</span>
              <span className="sld-chip">Drop-in iframe · React + HTML</span>
              <span className="sld-chip">CRM webhook · tracking pixel</span>
            </div>
          </Reveal>
          <Reveal delay={480}>
            <div className="sld-hero-stat-row">
              <HeroStat n={3} prefix="<" suffix="s" k="Qualify time" />
              <HeroStat n={42} suffix="%" k="Calendar show lift" />
              <HeroStat n={5} suffix=" days" k="Time to live" />
            </div>
          </Reveal>
        </div>
        <div className="sld-hero-right">
          <ParticleField count={28} />
          <TiltCard>
            <CalendarLandedMock />
          </TiltCard>
        </div>
      </div>
    ),
  },

  /* 04 — COST OF DOING NOTHING */
  {
    n: '04',
    title: 'Cost of doing nothing',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The cost of doing nothing
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Your closers are paid to close.</span>{' '}
            <em>Not to filter form fillers.</em>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            A mid-size online sales team burns an estimated{' '}
            <strong>
              $<AnimatedCounter to={420} />k a year
            </strong>{' '}
            in closer time and ad CAC on traffic that was never going to transact. The fix
            isn&apos;t more leads. The fix is a real fundability signal upstream.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-stat-row">
            <CountStat to={67} suffix="%" k="Form fillers · no budget / no fundability" />
            <CountStat to={2} suffix="hr" k="Closer time wasted per junk call" />
            <CountStat to={420} prefix="$" k="CAC inflation per junk lead (median)" />
            <CountStat to={11} suffix="%" k="Calendar show-rate · unqualified traffic" />
          </div>
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-section-title">Where the closer-hours actually go</div>
        </Reveal>
        <Reveal delay={560}>
          <TimeBreakdown />
        </Reveal>
      </div>
    ),
  },

  /* 05 — THE 3 PILLARS */
  {
    n: '05',
    title: 'The three pillars',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The pitch
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Smart form.</span>{' '}
            <span className="grad-blue">Pre-qual agents.</span>{' '}
            <span className="grad-blue-deep">Smart routing.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Three capabilities, one drop-in widget. Configure once, run forever.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-pillars">
            <Pillar
              n="01"
              head="Smart form"
              metric="< 3s"
              body="Drop a single iframe (or React component) into any funnel. The form reshapes its fields as the buyer answers — high-intent traffic gets the fast path, junky signal gets the verification gauntlet."
              tags={['Drop-in iframe', 'React + plain HTML', 'Mobile-first']}
            />
            <Pillar
              n="02"
              head="Pre-qual agents"
              metric="FCRA · 0 impact"
              body="On submit, ORACLE runs the buyer through soft-pull credit, income capacity, and fundability scoring. Three named agents, transparent thresholds, exportable audit log."
              tags={['Soft pull', 'Fundability tier', 'Audit log']}
            />
            <Pillar
              n="03"
              head="Smart routing"
              metric="Same minute"
              body="Qualified buyers land on the right closer's calendar within seconds. Unqualified buyers see a relevant alternative path. Your CRM gets the structured payload the same minute."
              tags={['Calendar routing', 'CRM webhook', 'Tracking pixel']}
            />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 06 — STAGE 1 · SMART FORM */
  {
    n: '06',
    title: 'Stage 1 — Smart form',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              How it works · 1 of 3 · Smart form
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="sld-h2">
              <span className="grad-blue-deep">One widget.</span>{' '}
              <span className="grad-blue">Reshapes itself live.</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              The smart form is a JavaScript widget that drops into any funnel. As the buyer
              answers, HELIX reorders questions based on partial answers, kills friction for
              high-intent traffic, and adds verification steps when the signal looks junky.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="sld-mini-stats">
              <MiniStat v={<AnimatedCounter to={3} prefix="< " suffix="s" />} k="To submit" />
              <MiniStat v="−41%" k="Form drop-off" />
              <MiniStat v="iframe" k="Drop-in install" />
              <MiniStat v="Mobile-first" k="Responsive" />
            </div>
          </Reveal>
          <Reveal delay={480}>
            <p className="sld-takeaway">
              For the rep: the form does the filtering you used to do on a discovery call. By the
              time a buyer hits submit, the agents already know if they&apos;re worth your time.
            </p>
          </Reveal>
        </div>
        <div className="sld-hero-right">
          <ParticleField count={14} />
          <FormMock />
        </div>
      </div>
    ),
  },

  /* 07 — STAGE 2 · PRE-QUAL AGENTS */
  {
    n: '07',
    title: 'Stage 2 — Pre-qual agents',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            How it works · 2 of 3 · Pre-qualification agents
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Three agents</span>{' '}
            <span className="grad-blue">run in parallel.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            On form submit, the buyer is evaluated by three agents simultaneously. Soft pull, income
            capacity, and fundability tier — all FCRA-compliant, all in under three seconds.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <AgentsViz />
        </Reveal>
      </div>
    ),
  },

  /* 08 — STAGE 3 · SMART ROUTING */
  {
    n: '08',
    title: 'Stage 3 — Smart routing',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            How it works · 3 of 3 · Smart routing
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Qualified buyers</span>{' '}
            <span className="grad-blue">land on the right closer&apos;s calendar.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            The routing rules you configure pick the right closer (or the right nurture sequence)
            and book the calendar slot the same minute the agents finish scoring. Your CRM gets the
            structured payload via webhook. Your tracking pixel fires only on funded events.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <RoutingFlow />
        </Reveal>
        <Reveal delay={480}>
          <div className="sld-mini-stats">
            <MiniStat v={<AnimatedCounter to={1} suffix=" min" />} k="Form → calendar" />
            <MiniStat v="Real-time" k="CRM webhook" />
            <MiniStat v="Pixel" k="Funded-event attribution" />
            <MiniStat v="Audit" k="7-yr retention" />
          </div>
        </Reveal>
      </div>
    ),
  },

  /* 09 — WITHOUT / WITH */
  {
    n: '09',
    title: 'Without vs With EZ Check',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            The change
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue">
              <AnimatedCounter to={11} suffix="%" /> calendar show
            </span>{' '}
            <span className="grad-blue-deep">
              becomes <AnimatedCounter to={50} suffix="–80%" delay={400} />.
            </span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <BarRace />
        </Reveal>
        <Reveal delay={400}>
          <p className="sld-sub">
            The lift comes from one place: your closers only see buyers who can actually transact.
            That&apos;s the leverage of putting a fundability gate upstream of the calendar — not
            downstream of it.
          </p>
        </Reveal>
      </div>
    ),
  },

  /* 10 — PRICING */
  {
    n: '10',
    title: 'Pricing',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Pricing
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">$5,000 once.</span>{' '}
            <span className="grad-blue">$3 per data pull.</span>{' '}
            <span className="grad-blue-deep">Nothing else.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            No monthly platform fee. No minimums. No origination percentage. No contract. Stop the
            meter any time by disabling the widget — existing pulls still bill that month.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <PricingGrid />
        </Reveal>
      </div>
    ),
  },

  /* 11 — ONBOARDING */
  {
    n: '11',
    title: 'Onboarding',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Onboarding · 3 modules · up to 5 business days
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Three short modules.</span>{' '}
            <span className="grad-blue">Saves automatically.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Each module maps 1:1 to a configuration screen — what you set on day one is what runs in
            production on day six.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <OnboardingModules />
        </Reveal>
      </div>
    ),
  },

  /* 12 — FINAL CTA */
  {
    n: '12',
    title: 'Activate',
    build: () => (
      <div className="sld-stack sld-stack-cta">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Ready when you are
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2 sld-h2-big">
            <span className="grad-blue-deep">Activate EZ Check.</span>{' '}
            <span className="grad-blue">Ship qualified buyers this week.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            One-time setup. Pay-as-you-pull. No contract. Your launch engineer is in your Slack
            channel within 1 business hour.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="sld-cta-actions">
            <Link href="/ez-check/checkout" className="sld-btn-primary sld-btn-xl">
              Activate now · $5,000 <ArrowIcon />
            </Link>
            <Link href="/landing/ez-check" className="sld-btn-ghost sld-btn-xl">
              Back to landing
            </Link>
          </div>
        </Reveal>
      </div>
    ),
  },
];

const SLIDES: Slide[] = SLIDES_RAW.map((s, idx) => ({
  ...s,
  n: String(idx + 1).padStart(2, '0'),
}));

/* ============================ helper components =========================== */

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stackRoot = document.querySelector('.sld-stack-root');
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setVisible(true);
        }
      },
      { root: stackRoot, threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`sld-reveal ${visible ? 'is-visible' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function AnimatedCounter({
  to,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1400,
  delay = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  delay?: number;
}): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stackRoot = document.querySelector('.sld-stack-root');
    let cancelled = false;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !cancelled) {
            const start = performance.now();
            const tick = (now: number) => {
              const elapsed = now - start - delay;
              if (elapsed < 0) {
                if (!cancelled) requestAnimationFrame(tick);
                return;
              }
              const t = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - t, 3);
              if (!cancelled) {
                setVal(to * eased);
                if (t < 1) requestAnimationFrame(tick);
              }
            };
            requestAnimationFrame(tick);
            obs.disconnect();
          }
        }
      },
      { root: stackRoot, threshold: 0.4 },
    );
    obs.observe(el);
    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [to, duration, delay]);
  const formatted = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString('en-US');
  return (
    <span ref={ref} className="sld-count">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

function HeroStat({
  n,
  prefix = '',
  suffix = '',
  k,
}: {
  n: number;
  prefix?: string;
  suffix?: string;
  k: string;
}): JSX.Element {
  return (
    <div className="sld-hero-stat">
      <div className="sld-hero-stat-v">
        <AnimatedCounter to={n} prefix={prefix} suffix={suffix} />
      </div>
      <div className="sld-hero-stat-k">{k}</div>
    </div>
  );
}

function CountStat({
  to,
  prefix = '',
  suffix = '',
  decimals = 0,
  k,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  k: string;
}): JSX.Element {
  return (
    <div className="sld-stat">
      <div className="sld-stat-v">
        <AnimatedCounter to={to} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <div className="sld-stat-k">{k}</div>
    </div>
  );
}

function Pillar({
  n,
  head,
  metric,
  body,
  tags,
}: {
  n: string;
  head: string;
  metric: string;
  body: string;
  tags: string[];
}): JSX.Element {
  return (
    <div className="sld-pillar">
      <div className="sld-pillar-glow" aria-hidden />
      <div className="sld-pillar-n">{n}</div>
      <div className="sld-pillar-metric">{metric}</div>
      <div className="sld-pillar-h">{head}</div>
      <div className="sld-pillar-b">{body}</div>
      <div className="sld-pillar-tags">
        {tags.map((t, i) => (
          <span key={i} className="sld-pillar-tag">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ v, k }: { v: React.ReactNode; k: string }): JSX.Element {
  return (
    <div className="sld-mini-stat">
      <div className="sld-mini-stat-v">{v}</div>
      <div className="sld-mini-stat-k">{k}</div>
    </div>
  );
}

/** 3D-tilted scene + card. Mouse-parallax. */
function TiltCard({ children }: { children: React.ReactNode }): JSX.Element {
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = sceneRef.current;
    const card = cardRef.current;
    if (!scene || !card) return;
    const onMove = (e: MouseEvent) => {
      const r = scene.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--tx', `${-y * 12}deg`);
      card.style.setProperty('--ty', `${x * 16}deg`);
    };
    const onLeave = () => {
      card.style.setProperty('--tx', '6deg');
      card.style.setProperty('--ty', '-10deg');
    };
    scene.addEventListener('mousemove', onMove);
    scene.addEventListener('mouseleave', onLeave);
    onLeave();
    return () => {
      scene.removeEventListener('mousemove', onMove);
      scene.removeEventListener('mouseleave', onLeave);
    };
  }, []);
  return (
    <div className="sld-tilt-scene" ref={sceneRef}>
      <div className="sld-tilt-card" ref={cardRef}>
        {children}
      </div>
    </div>
  );
}

/** Mock — qualified buyer landed on closer calendar. The hero card. */
function CalendarLandedMock(): JSX.Element {
  return (
    <div className="sld-mock">
      <div className="sld-mock-head">
        <span className="sld-mock-pill">
          <span className="sld-mock-pill-dot" /> Qualified · routed
        </span>
        <span className="sld-mock-meta">Illustrative</span>
      </div>
      <div className="sld-mock-project">Inbound buyer · pre-qualified</div>
      <div className="sld-mock-amount">
        Jordan M.
        <span className="sld-mock-amount-sub">Tier A · verified</span>
      </div>
      <div className="sld-mock-rows">
        <div>
          <div className="sld-mock-k">Score</div>
          <div className="sld-mock-v">724 · soft pull</div>
        </div>
        <div>
          <div className="sld-mock-k">Income</div>
          <div className="sld-mock-v">$98k verified</div>
        </div>
      </div>
      <div className="sld-mock-bar">
        <div className="sld-mock-bar-fill" />
      </div>
      <div className="sld-mock-stages">
        <span className="on">Form</span>
        <span className="on">Soft pull</span>
        <span className="on">Score</span>
        <span className="cur">Calendar</span>
        <span>Closer</span>
      </div>
      <div className="sld-mock-cta">Booked · Sarah · Thu 2:00 PM →</div>
      <div className="sld-mock-foot">FCRA soft pull · 0 impact · 7-yr audit log</div>
    </div>
  );
}

function ParticleField({ count = 24 }: { count?: number }): JSX.Element {
  // Deterministic — same output server + client, no hydration mismatch.
  const particles = Array.from({ length: count }).map((_, i) => {
    const seed = i * 9301 + 49297;
    const seed2 = i * 1741 + 27361;
    const left = seed % 100;
    const top = (seed * 2) % 100;
    const dur = 8 + (seed % 7);
    const delay = (seed2 % 5) + (seed2 % 10) / 10;
    const size = 2 + (seed % 4);
    return { i, left, top, dur, delay, size };
  });
  return (
    <div className="sld-particles" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.i}
          className="sld-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Smart-form widget mockup. Looks like an embedded iframe. */
function FormMock(): JSX.Element {
  return (
    <div className="sld-form-mock">
      <div className="sld-form-bezel">
        <div className="sld-form-screen">
          <div className="sld-form-header">
            <span className="sld-form-brand">EZ Check · qualification</span>
            <span className="sld-form-meta">FCRA · 0 impact</span>
          </div>
          <div className="sld-form-title">Quick pre-qual</div>
          <div className="sld-form-sub">Takes about 3 seconds. Soft pull only.</div>
          <div className="sld-form-fields">
            {[
              { k: 'Email', v: 'jordan@example.com' },
              { k: 'Phone', v: '(415) 555-0192' },
              { k: 'Annual income', v: '$96,000' },
              { k: 'Budget range', v: '$5k – $15k' },
            ].map((f, i) => (
              <div key={i} className="sld-form-field" style={{ animationDelay: `${i * 0.4}s` }}>
                <div className="sld-form-k">{f.k}</div>
                <div className="sld-form-v">{f.v}</div>
              </div>
            ))}
          </div>
          <div className="sld-form-submit">Submit · book call</div>
        </div>
      </div>
    </div>
  );
}

/** The three pre-qual agents firing in parallel. */
function AgentsViz(): JSX.Element {
  const AGENTS = [
    {
      n: '01',
      code: 'SOFT-PULL',
      label: 'Credit · FCRA',
      stat: { k: 'Score returned', v: '724' },
      tick: 'Decision in 1.2s · 0 credit impact',
    },
    {
      n: '02',
      code: 'INCOME',
      label: 'Capacity · GLBA',
      stat: { k: 'Verified income', v: '$98,000' },
      tick: 'Matched provider_07 · $0.32 cost',
    },
    {
      n: '03',
      code: 'TIER',
      label: 'Fundability · ORACLE',
      stat: { k: 'Buyer tier', v: 'A · top decile' },
      tick: 'Model AUC 0.91 · last retrain 4h ago',
    },
  ];
  return (
    <div className="sld-agents-viz">
      <div className="sld-agents-app">
        <div className="sld-agents-eyebrow">ONE SUBMISSION</div>
        <div className="sld-agents-app-card">
          <div className="sld-agents-row">
            <span className="sld-agents-k">Buyer</span>
            <span className="sld-agents-v">Jordan M.</span>
          </div>
          <div className="sld-agents-row">
            <span className="sld-agents-k">Funnel</span>
            <span className="sld-agents-v">meta_advantage</span>
          </div>
          <div className="sld-agents-row">
            <span className="sld-agents-k">Submitted</span>
            <span className="sld-agents-v">just now</span>
          </div>
          <div className="sld-agents-row">
            <span className="sld-agents-k">Consent</span>
            <span className="sld-agents-v">FCRA · GLBA</span>
          </div>
        </div>
        <div className="sld-agents-sig">
          <span className="sld-agents-sig-dot" />
          Fans out to three agents in parallel
        </div>
      </div>

      <div className="sld-agents-bus" aria-hidden>
        <svg viewBox="0 0 100 240" preserveAspectRatio="none">
          {AGENTS.map((_, i) => (
            <path
              key={i}
              d={`M 0 120 C 50 120, 50 ${40 + i * 80}, 100 ${40 + i * 80}`}
              stroke="rgba(59, 130, 246, 0.45)"
              strokeWidth="1.8"
              strokeDasharray="4 4"
              fill="none"
            />
          ))}
        </svg>
      </div>

      <div className="sld-agents-results">
        <div className="sld-agents-results-eyebrow">
          <span className="sld-agents-results-pulse" />
          PARALLEL · ALL THREE RETURN IN UNDER 3s
        </div>
        {AGENTS.map((a, i) => (
          <div
            key={a.code}
            className="sld-agents-result"
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            <span className="sld-agents-result-n">{a.n}</span>
            <div className="sld-agents-result-body">
              <span className="sld-agents-result-code">
                {a.code}
                <span className="sld-agents-result-label">{a.label}</span>
              </span>
              <span className="sld-agents-result-stat">
                <span className="sld-agents-result-stat-k">{a.stat.k}</span>
                <span className="sld-agents-result-stat-v">{a.stat.v}</span>
              </span>
              <span className="sld-agents-result-tick">{a.tick}</span>
            </div>
          </div>
        ))}
        <div className="sld-agents-results-foot">
          <span className="sld-agents-results-foot-k">Composite tier</span>
          <span className="sld-agents-results-foot-v">Tier A · qualified · route → calendar</span>
        </div>
      </div>
    </div>
  );
}

/** Form → ORACLE → Calendar + CRM + Pixel — the routing fan-out. */
function RoutingFlow(): JSX.Element {
  return (
    <div className="sld-routing">
      <div className="sld-routing-node">
        <div className="sld-routing-node-tag">FORM SUBMIT</div>
        <div className="sld-routing-node-h">Buyer hits submit</div>
        <div className="sld-routing-node-b">HELIX-rendered smart form on your funnel.</div>
      </div>
      <div className="sld-routing-arrow">→</div>
      <div className="sld-routing-node">
        <div className="sld-routing-node-tag">PRE-QUAL</div>
        <div className="sld-routing-node-h">3 agents · in parallel</div>
        <div className="sld-routing-node-b">
          Soft pull · income · fundability tier. Under 3 seconds.
        </div>
      </div>
      <div className="sld-routing-arrow">→</div>
      <div className="sld-routing-fanout">
        <div className="sld-routing-fanout-node accent">
          <div className="sld-routing-node-tag accent">CALENDAR</div>
          <div className="sld-routing-node-h">Closer&apos;s calendar</div>
          <div className="sld-routing-node-b">Booked the same minute.</div>
        </div>
        <div className="sld-routing-fanout-node">
          <div className="sld-routing-node-tag">CRM WEBHOOK</div>
          <div className="sld-routing-node-h">Your existing CRM</div>
          <div className="sld-routing-node-b">Structured payload posted.</div>
        </div>
        <div className="sld-routing-fanout-node">
          <div className="sld-routing-node-tag">PIXEL</div>
          <div className="sld-routing-node-h">Tracking pixel</div>
          <div className="sld-routing-node-b">Fires on funded events only.</div>
        </div>
      </div>
    </div>
  );
}

/** Without/With animated bar comparison. */
function BarRace(): JSX.Element {
  return (
    <div className="sld-bar-race">
      <div className="sld-bar-row">
        <div className="sld-bar-label">Without EZ Check (11% calendar show)</div>
        <div className="sld-bar-track">
          <div className="sld-bar-fill without" style={{ width: '11%' }}>
            <span>11%</span>
          </div>
        </div>
      </div>
      <div className="sld-bar-row">
        <div className="sld-bar-label">With EZ Check (50–80% calendar show · illustrative)</div>
        <div className="sld-bar-track">
          <div className="sld-bar-fill with" style={{ width: '65%' }}>
            <span>50–80%</span>
          </div>
        </div>
      </div>
      <div className="sld-bar-delta">
        <span className="sld-bar-delta-tag">Delta</span>
        <span className="sld-bar-delta-val">+39–69 pts calendar show-rate</span>
        <span className="sld-bar-delta-sub">
          Qualified-only traffic vs. unqualified baseline · illustrative
        </span>
      </div>
    </div>
  );
}

/** Time/cost breakdown for the "where the closer hours go" panel. */
function TimeBreakdown(): JSX.Element {
  const ROWS = [
    { k: 'Pre-call qualification by hand', v: '38%', pct: 38 },
    { k: 'No-show follow-ups', v: '26%', pct: 26 },
    { k: 'Form fillers who never had budget', v: '22%', pct: 22 },
    { k: 'Closing actual deals', v: '14%', pct: 14 },
  ];
  return (
    <div className="sld-breakdown">
      {ROWS.map((r, i) => (
        <div key={i} className="sld-breakdown-row">
          <div className="sld-breakdown-k">{r.k}</div>
          <div className="sld-breakdown-bar">
            <div
              className={`sld-breakdown-fill ${i === ROWS.length - 1 ? 'accent' : ''}`}
              style={{ width: `${r.pct}%` }}
            />
          </div>
          <div className="sld-breakdown-v">{r.v}</div>
        </div>
      ))}
      <div className="sld-breakdown-foot">
        Source: EazePay closer-time study, n=124 inside-sales reps, 2025
      </div>
    </div>
  );
}

/** Pricing 3-up. */
function PricingGrid(): JSX.Element {
  return (
    <div className="sld-pricing-grid">
      <article className="sld-tier is-hero">
        <div className="sld-tier-tag">01 · SETUP</div>
        <h3 className="sld-tier-head">One-time setup fee</h3>
        <p className="sld-tier-body">
          Workspace, smart form, smart routing, agent stack, embed snippet, sales-team training.
        </p>
        <div className="sld-tier-foot">
          <div className="sld-tier-v">$5,000</div>
          <div className="sld-tier-when">USD · charged on signing</div>
        </div>
      </article>
      <article className="sld-tier">
        <div className="sld-tier-tag">02 · USAGE</div>
        <h3 className="sld-tier-head">Per data pull</h3>
        <p className="sld-tier-body">
          Every form submission that triggers a qualification pull. Submissions that bounce before
          the pull are free.
        </p>
        <div className="sld-tier-foot">
          <div className="sld-tier-v">$3</div>
          <div className="sld-tier-when">per pull · billed monthly</div>
        </div>
      </article>
      <article className="sld-tier">
        <div className="sld-tier-tag">03 · CALENDAR</div>
        <h3 className="sld-tier-head">Qualified buyers booked</h3>
        <p className="sld-tier-body">
          Smart routing drops each qualified buyer onto a closer&apos;s calendar in the same minute.
        </p>
        <div className="sld-tier-foot">
          <div className="sld-tier-v">$0</div>
          <div className="sld-tier-when">no per-booking fee · ever</div>
        </div>
      </article>
    </div>
  );
}

/** Onboarding 3-module strip. */
function OnboardingModules(): JSX.Element {
  return (
    <div className="sld-onb-strip">
      {EZ_CHECK_MODULES.map((m) => (
        <div key={m.id} className="sld-onb-mod">
          <div className="sld-onb-mod-n">
            {m.n} · {m.agent}
          </div>
          <div className="sld-onb-mod-h">{m.title}</div>
          <div className="sld-onb-mod-b">{m.body}</div>
          <div className="sld-onb-mod-time">⌛ {m.time}</div>
        </div>
      ))}
    </div>
  );
}

/** Agenda items for slide 02. */
function Agenda(): JSX.Element {
  const ITEMS = [
    {
      n: '01',
      h: 'The cost of doing nothing',
      b: 'Where your closers actually spend their hours.',
    },
    { n: '02', h: 'Three pillars', b: 'Smart form · pre-qual agents · smart routing.' },
    {
      n: '03',
      h: 'How the agents score a buyer',
      b: 'FCRA soft pull · income capacity · fundability tier.',
    },
    { n: '04', h: 'Without / With', b: 'Calendar show-rate before and after the gate.' },
    { n: '05', h: 'Pricing + onboarding', b: '$5,000 once · $3 per pull · live in up to 5 days.' },
    { n: '06', h: 'Live activation', b: 'We turn it on for your funnel on the call.' },
  ];
  return (
    <div className="sld-agenda">
      {ITEMS.map((it) => (
        <div key={it.n} className="sld-agenda-item">
          <div className="sld-agenda-n">{it.n}</div>
          <div>
            <div className="sld-agenda-h">{it.h}</div>
            <div className="sld-agenda-b">{it.b}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ============================ default export ============================== */

export default function EzCheckSalesDeck(): JSX.Element {
  const [idx, setIdx] = useState(0);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIdx(clamped);
    const el = document.getElementById(`slide-${clamped}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const stackRoot = document.querySelector('.sld-stack-root');
    if (!stackRoot) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const n = Number((e.target as HTMLElement).dataset.idx ?? 0);
            setIdx(n);
          }
        });
      },
      { root: stackRoot, threshold: 0.55 },
    );
    SLIDES.forEach((_, i) => {
      const el = document.getElementById(`slide-${i}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goTo(idx + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(idx - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(SLIDES.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, goTo]);

  return (
    <div className="sld-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="sld-mesh" aria-hidden />

      <div className="sld-chrome">
        <div className="sld-brand">{EZ_CHECK_COPY.name} · Sales deck</div>
        <div className="sld-counter">
          <span className="sld-counter-cur">{String(idx + 1).padStart(2, '0')}</span>
          <span className="sld-counter-sep"> / </span>
          <span className="sld-counter-tot">{String(SLIDES.length).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="sld-nav">
        <button
          type="button"
          className="sld-nav-btn"
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          aria-label="Previous slide"
        >
          ←
        </button>
        <div className="sld-dots">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`sld-dot ${i === idx ? 'is-active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              title={`${s.n} · ${s.title}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="sld-nav-btn"
          onClick={() => goTo(idx + 1)}
          disabled={idx === SLIDES.length - 1}
          aria-label="Next slide"
        >
          →
        </button>
      </div>

      <main className="sld-stack-root">
        {SLIDES.map((s, i) => (
          <section
            key={i}
            id={`slide-${i}`}
            data-idx={i}
            className="sld-slide"
            aria-label={`Slide ${i + 1}: ${s.title}`}
          >
            <div className="sld-slide-n">{s.n}</div>
            {s.build()}
          </section>
        ))}
      </main>
    </div>
  );
}

/* =================================== CSS ================================= */

const CSS = `
.sld-root {
  --ezk-blue: #3B82F6;
  --ezk-blue-2: #60A5FA;
  --ezk-blue-deep: #1E3A8A;
  --ezk-blue-light: #F0F9FF;
  --ezk-ink: #0F172A;
  --ezk-ink-2: #1E293B;
  --ezk-mute: #64748B;
  --ezk-line: rgba(59, 130, 246, 0.12);
  --ezk-line-strong: rgba(59, 130, 246, 0.22);

  position: relative;
  background: linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 30%, #F8FAFC 65%, #FFFFFF 100%);
  color: var(--ezk-ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}
.sld-root * { box-sizing: border-box; }
.sld-root a { color: inherit; text-decoration: none; }
.sld-root button { font-family: inherit; cursor: pointer; }

/* Animated gradient mesh — fixed behind everything */
.sld-mesh {
  position: fixed; inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 40% at 15% 20%, rgba(96, 165, 250, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 90%, rgba(96, 165, 250, 0.10) 0%, transparent 55%);
  animation: sldMeshDrift 24s ease-in-out infinite;
}
@keyframes sldMeshDrift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-30px, 20px) scale(1.05); }
  66% { transform: translate(20px, -10px) scale(0.98); }
}

/* Gradient text */
.sld-root .grad-blue {
  background: linear-gradient(120deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-root .grad-blue-deep {
  background: linear-gradient(120deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* Chrome — top-right brand + counter */
.sld-chrome {
  position: fixed; top: 24px; left: 0; right: 0;
  z-index: 50;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 32px;
  pointer-events: none;
}
.sld-brand {
  font-size: 13px; font-weight: 600;
  color: var(--ezk-ink-2);
  letter-spacing: -0.005em;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  pointer-events: auto;
}
.sld-counter {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--ezk-ink-2);
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  pointer-events: auto;
}
.sld-counter-cur { color: var(--ezk-blue); }
.sld-counter-sep { color: var(--ezk-mute); margin: 0 2px; }

/* Bottom nav — arrows + dots */
.sld-nav {
  position: fixed; bottom: 28px; left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  display: flex; align-items: center; gap: 12px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  box-shadow: 0 20px 40px -16px rgba(15, 23, 42, 0.20);
}
.sld-nav-btn {
  width: 36px; height: 36px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  font-size: 18px;
  color: var(--ezk-ink-2);
  transition: background .15s ease, color .15s ease;
}
.sld-nav-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.08);
  color: var(--ezk-blue);
}
.sld-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.sld-dots { display: inline-flex; gap: 5px; padding: 0 6px; }
.sld-dot {
  width: 7px; height: 7px;
  border: 0; padding: 0;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.25);
  transition: all .2s ease;
}
.sld-dot:hover { background: var(--ezk-blue); transform: scale(1.4); }
.sld-dot.is-active {
  background: var(--ezk-blue);
  width: 22px;
  border-radius: 999px;
}

/* Slide structure */
.sld-stack-root {
  position: relative;
  z-index: 1;
  scroll-snap-type: y mandatory;
  height: 100vh;
  overflow-y: scroll;
}
.sld-slide {
  scroll-snap-align: start;
  scroll-snap-stop: always;
  height: 100vh;
  min-height: 640px;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 64px;
  position: relative;
}
.sld-slide-n {
  position: absolute;
  top: 28px; left: 32px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.22em;
  font-weight: 700; color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-stack {
  max-width: 1180px;
  width: 100%;
  display: flex; flex-direction: column;
  gap: 24px;
}
.sld-stack-cover { align-items: flex-start; }
.sld-stack-cta { max-width: 980px; align-items: flex-start; }
.sld-grid-hero {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 56px;
  align-items: center;
  max-width: 1280px;
}
.sld-hero-left { display: flex; flex-direction: column; gap: 24px; }
.sld-hero-right { position: relative; min-height: 480px; }

/* Reveal */
.sld-reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1),
              transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.sld-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Eyebrow */
.sld-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  padding: 6px 14px;
  background: rgba(59, 130, 246, 0.10);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
  align-self: flex-start;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--ezk-blue-2);
  box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.5);
  animation: sldPulse 1.6s ease-in-out infinite;
}
@keyframes sldPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(96, 165, 250, 0); }
}

/* Headlines */
.sld-h1 {
  font-size: clamp(48px, 6vw, 80px); font-weight: 600;
  letter-spacing: -0.04em; line-height: 1.02;
  margin: 0;
}
.sld-h2 {
  font-size: clamp(40px, 4.6vw, 56px); font-weight: 600;
  letter-spacing: -0.034em; line-height: 1.08;
  margin: 0;
}
.sld-h2-big { font-size: clamp(44px, 5.2vw, 64px); }
.sld-h2 em {
  font-weight: 400;
  font-style: italic;
  color: var(--ezk-ink-2);
}
.sld-sub {
  font-size: 19px; line-height: 1.55;
  color: var(--ezk-ink-2);
  max-width: 800px;
  margin: 0;
}
.sld-sub strong { color: var(--ezk-blue); font-weight: 700; }
.sld-count { font-variant-numeric: tabular-nums; }
.sld-takeaway {
  margin: 0;
  padding: 16px 20px;
  border-left: 3px solid var(--ezk-blue);
  background: rgba(59, 130, 246, 0.06);
  border-radius: 0 12px 12px 0;
  font-size: 14px; color: var(--ezk-ink-2); line-height: 1.55;
  max-width: 600px;
}
.sld-section-title {
  margin-top: 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 12px; letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}

/* Trust chips */
.sld-chips {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 8px;
}
.sld-chip {
  display: inline-flex; align-items: center;
  font-size: 12px; letter-spacing: 0.04em;
  color: var(--ezk-ink-2);
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
}

/* Cover */
.sld-cover-mark {
  font-size: 56px; font-weight: 700; letter-spacing: -0.02em;
  display: inline-flex; align-items: center;
}
.sld-cover-mark-l { color: var(--ezk-blue); }
.sld-cover-mark-slash { color: var(--ezk-mute); margin: 0 4px; font-weight: 300; }
.sld-cover-mark-r { color: var(--ezk-ink); }
.sld-cover-h1 {
  margin: 0;
  font-size: clamp(56px, 7.2vw, 96px);
  font-weight: 600; letter-spacing: -0.04em; line-height: 1.02;
}
.sld-cover-sub {
  margin: 0;
  font-size: 20px; line-height: 1.5;
  color: var(--ezk-ink-2);
  max-width: 760px;
}
.sld-cover-meta {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px; letter-spacing: 0.18em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px;
}
.sld-cover-meta-sep { opacity: 0.5; }

/* Hero stat row */
.sld-hero-stat-row {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 16px;
  padding: 20px 0;
  border-top: 1px solid var(--ezk-line);
}
.sld-hero-stat-v {
  font-size: 30px; font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--ezk-ink);
}
.sld-hero-stat-k {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.14em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}

/* Stat row */
.sld-stat-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--ezk-line);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--ezk-line);
  margin-top: 8px;
}
.sld-stat {
  background: rgba(255, 255, 255, 0.92);
  padding: 22px 24px;
}
.sld-stat-v {
  font-size: 36px; font-weight: 800; letter-spacing: -0.025em;
  color: var(--ezk-ink);
  line-height: 1;
}
.sld-stat-k {
  margin-top: 6px;
  font-size: 12px; color: var(--ezk-mute); line-height: 1.4;
}

/* Pillars */
.sld-pillars {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 8px;
  perspective: 1400px;
}
.sld-pillar {
  position: relative;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.10), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 251, 255, 0.97) 100%);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 22px;
  padding: 26px 26px 22px;
  box-shadow:
    0 22px 60px -32px rgba(59, 130, 246, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: hidden;
  display: flex; flex-direction: column;
  gap: 4px;
}
.sld-pillar-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 110%, rgba(96, 165, 250, 0.20), transparent 60%);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}
.sld-pillar:hover {
  transform: translateY(-6px) rotateX(2deg);
  box-shadow:
    0 36px 80px -32px rgba(59, 130, 246, 0.40),
    inset 0 1px 0 rgba(255, 255, 255, 1);
}
.sld-pillar:hover .sld-pillar-glow { opacity: 1; }
.sld-pillar > * { position: relative; z-index: 1; }
.sld-pillar-n {
  display: inline-block;
  width: fit-content;
  padding: 3px 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
}
.sld-pillar-metric {
  margin-top: 12px;
  font-size: 40px; font-weight: 700;
  letter-spacing: -0.038em;
  line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-pillar-h {
  margin-top: 10px;
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--ezk-ink);
}
.sld-pillar-b {
  margin-top: 6px;
  font-size: 13.5px; color: var(--ezk-ink-2); line-height: 1.55;
}
.sld-pillar-tags {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--ezk-line);
  display: flex; flex-wrap: wrap;
  gap: 6px;
}
.sld-pillar-tag {
  font-size: 10.5px; letter-spacing: 0.04em;
  font-weight: 600;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.16);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}

/* Mini stats */
.sld-mini-stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--ezk-line);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--ezk-line);
  max-width: 640px;
}
.sld-mini-stat {
  background: rgba(255, 255, 255, 0.92);
  padding: 16px 18px;
}
.sld-mini-stat-v {
  font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--ezk-ink);
  line-height: 1.1;
}
.sld-mini-stat-k {
  margin-top: 4px;
  font-size: 10.5px; letter-spacing: 0.10em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}

/* Tilt scene + card */
.sld-tilt-scene {
  perspective: 1400px;
  perspective-origin: 50% 50%;
  width: 100%;
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  z-index: 2;
}
.sld-tilt-card {
  --tx: 6deg;
  --ty: -10deg;
  transform-style: preserve-3d;
  transform: rotateX(var(--tx)) rotateY(var(--ty));
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

/* Mock offer card */
.sld-mock {
  width: 440px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 24px;
  padding: 26px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.55),
    0 30px 60px -30px rgba(59, 130, 246, 0.35),
    0 1px 0 rgba(255, 255, 255, 1) inset;
}
.sld-mock-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ezk-line);
}
.sld-mock-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(96, 165, 250, 0.14);
  border-radius: 999px;
}
.sld-mock-pill-dot { width: 5px; height: 5px; border-radius: 999px; background: var(--ezk-blue-2); }
.sld-mock-meta {
  font-size: 9px; letter-spacing: 0.18em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.sld-mock-project {
  margin-top: 14px;
  font-size: 10.5px; letter-spacing: 0.22em;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-mock-amount {
  margin-top: 4px;
  font-size: 38px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
  display: flex; align-items: baseline; gap: 12px;
  flex-wrap: wrap;
}
.sld-mock-amount-sub {
  font-size: 12px; font-weight: 600;
  color: var(--ezk-blue);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.sld-mock-rows {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--ezk-line);
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.sld-mock-k {
  font-size: 9px; letter-spacing: 0.20em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.sld-mock-v {
  margin-top: 4px;
  font-size: 14px; font-weight: 600;
  color: var(--ezk-ink);
}
.sld-mock-bar {
  margin-top: 18px;
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.sld-mock-bar-fill {
  height: 100%;
  width: 78%;
  background: linear-gradient(90deg, var(--ezk-blue-deep) 0%, var(--ezk-blue-2) 100%);
  border-radius: 999px;
  animation: sldBarFill 1.8s ease-out;
}
@keyframes sldBarFill {
  from { width: 0%; }
  to { width: 78%; }
}
.sld-mock-stages {
  margin-top: 10px;
  display: flex; justify-content: space-between;
  font-size: 9px; letter-spacing: 0.10em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.sld-mock-stages .on { color: var(--ezk-blue); }
.sld-mock-stages .cur {
  color: var(--ezk-blue-deep);
  position: relative;
}
.sld-mock-stages .cur::after {
  content: '';
  position: absolute; bottom: -4px; left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 999px;
  background: var(--ezk-blue-2);
}
.sld-mock-cta {
  margin-top: 18px;
  padding: 13px 16px;
  text-align: center;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  border-radius: 12px;
  font-size: 13.5px; font-weight: 700;
  letter-spacing: 0.02em;
}
.sld-mock-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--ezk-line);
  font-size: 10px; letter-spacing: 0.14em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  text-align: center;
}

/* Particles */
.sld-particles {
  position: absolute; inset: 0;
  pointer-events: none;
  z-index: 0;
}
.sld-particle {
  position: absolute;
  border-radius: 999px;
  background: var(--ezk-blue-2);
  box-shadow: 0 0 6px rgba(96, 165, 250, 0.5);
  animation: sldFloat 12s ease-in-out infinite;
  opacity: 0.4;
}
@keyframes sldFloat {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 0.55; }
  50% { transform: translateY(-40px) translateX(20px); opacity: 0.4; }
  90% { opacity: 0.4; }
  100% { transform: translateY(-80px) translateX(-10px); opacity: 0; }
}

/* Form mock (Stage 1) */
.sld-form-mock {
  position: relative;
  z-index: 2;
  width: 400px;
  margin: 0 auto;
}
.sld-form-bezel {
  background: linear-gradient(135deg, #1F2A44 0%, #0F172A 100%);
  padding: 12px;
  border-radius: 20px;
  box-shadow:
    0 50px 100px -40px rgba(15, 23, 42, 0.45),
    0 1px 0 rgba(255, 255, 255, 0.1) inset;
}
.sld-form-screen {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}
.sld-form-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ezk-line);
}
.sld-form-brand {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
}
.sld-form-meta {
  font-size: 9px; letter-spacing: 0.16em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.sld-form-title {
  margin-top: 16px;
  font-size: 22px; font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ezk-ink);
}
.sld-form-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--ezk-mute);
}
.sld-form-fields {
  margin-top: 18px;
  display: flex; flex-direction: column;
  gap: 10px;
}
.sld-form-field {
  display: flex; flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid var(--ezk-line);
  border-radius: 10px;
  opacity: 0;
  animation: sldFieldIn 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
@keyframes sldFieldIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.sld-form-k {
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-form-v {
  font-size: 14px; font-weight: 600;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.sld-form-submit {
  margin-top: 18px;
  padding: 13px;
  text-align: center;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  border-radius: 10px;
  font-size: 13.5px; font-weight: 700;
}

/* Agents viz (Stage 2) */
.sld-agents-viz {
  display: grid;
  grid-template-columns: 260px 100px 1fr;
  gap: 16px;
  align-items: center;
  margin-top: 8px;
}
.sld-agents-app { display: flex; flex-direction: column; gap: 8px; }
.sld-agents-eyebrow {
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-agents-app-card {
  padding: 16px;
  background:
    radial-gradient(ellipse 80% 100% at 0% 0%, rgba(96, 165, 250, 0.12), transparent 70%),
    rgba(255, 255, 255, 0.96);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 8px;
  box-shadow: 0 14px 32px -16px rgba(59, 130, 246, 0.30);
}
.sld-agents-row {
  display: flex; justify-content: space-between; gap: 8px;
  padding: 4px 0;
  border-bottom: 1px dashed var(--ezk-line);
  font-size: 12px;
}
.sld-agents-row:last-child { border-bottom: 0; }
.sld-agents-k { color: var(--ezk-mute); letter-spacing: 0.04em; }
.sld-agents-v { color: var(--ezk-ink); font-weight: 600; font-variant-numeric: tabular-nums; }
.sld-agents-sig {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px;
  color: var(--ezk-blue);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-agents-sig-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--ezk-blue-2);
  animation: sldPulse 1.6s ease-in-out infinite;
}
.sld-agents-bus { height: 240px; }
.sld-agents-results {
  display: flex; flex-direction: column;
  gap: 8px;
}
.sld-agents-results-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  margin-bottom: 4px;
}
.sld-agents-results-pulse {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--ezk-blue-2);
  animation: sldPulse 1.6s ease-in-out infinite;
}
.sld-agents-result {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: stretch;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--ezk-line);
  border-radius: 12px;
  opacity: 0;
  animation: sldQuoteIn 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
@keyframes sldQuoteIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
.sld-agents-result-n {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  border-radius: 6px;
  width: 28px;
  align-self: start;
  padding: 4px 0;
}
.sld-agents-result-body {
  display: grid; grid-template-columns: 1.3fr 1fr;
  gap: 14px; align-items: center;
}
.sld-agents-result-code {
  display: flex; flex-direction: column; gap: 2px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 12px; font-weight: 700;
  color: var(--ezk-ink);
}
.sld-agents-result-label {
  font-family: inherit;
  font-size: 11px; font-weight: 500;
  color: var(--ezk-mute);
  text-transform: none;
  letter-spacing: 0;
}
.sld-agents-result-stat {
  display: flex; flex-direction: column; gap: 2px;
  text-align: right;
}
.sld-agents-result-stat-k {
  font-size: 10px; letter-spacing: 0.14em;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-agents-result-stat-v {
  font-size: 15px; font-weight: 700;
  color: var(--ezk-blue);
  font-variant-numeric: tabular-nums;
}
.sld-agents-result-tick {
  grid-column: 1 / -1;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed var(--ezk-line);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px;
  color: var(--ezk-mute);
}
.sld-agents-results-foot {
  margin-top: 8px;
  padding: 14px 16px;
  background:
    radial-gradient(ellipse 80% 100% at 0% 0%, rgba(96, 165, 250, 0.18), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  border-radius: 14px;
  display: flex; justify-content: space-between; align-items: center;
  gap: 14px;
}
.sld-agents-results-foot-k {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue-2);
  text-transform: uppercase;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.sld-agents-results-foot-v {
  font-size: 15px; font-weight: 700;
  color: #fff;
}

/* Routing flow (Stage 3) */
.sld-routing {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1.4fr;
  gap: 14px;
  align-items: center;
  margin-top: 8px;
}
.sld-routing-node {
  padding: 18px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--ezk-line);
  border-radius: 14px;
  box-shadow: 0 18px 40px -22px rgba(59, 130, 246, 0.22);
}
.sld-routing-node-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-routing-node-tag.accent { color: var(--ezk-blue); }
.sld-routing-node-h {
  margin-top: 6px;
  font-size: 14px; font-weight: 700;
  letter-spacing: -0.014em;
  color: var(--ezk-ink);
}
.sld-routing-node-b {
  margin-top: 4px;
  font-size: 12px; line-height: 1.5;
  color: var(--ezk-ink-2);
}
.sld-routing-arrow {
  color: var(--ezk-blue);
  font-size: 22px;
  font-weight: 700;
}
.sld-routing-fanout {
  display: flex; flex-direction: column; gap: 8px;
}
.sld-routing-fanout-node {
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--ezk-line);
  border-radius: 12px;
}
.sld-routing-fanout-node.accent {
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(96, 165, 250, 0.18), transparent 65%),
    rgba(255, 255, 255, 0.98);
  border-color: var(--ezk-line-strong);
  box-shadow: 0 14px 30px -14px rgba(59, 130, 246, 0.32);
}

/* Bar race */
.sld-bar-race {
  display: flex; flex-direction: column; gap: 18px;
  margin-top: 8px;
}
.sld-bar-row {
  display: grid; grid-template-columns: 280px 1fr;
  gap: 18px; align-items: center;
}
.sld-bar-label {
  font-size: 13.5px; font-weight: 600;
  color: var(--ezk-ink-2);
}
.sld-bar-track {
  height: 36px;
  background: rgba(15, 23, 42, 0.05);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}
.sld-bar-fill {
  height: 100%;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: flex-end;
  padding-right: 14px;
  font-size: 13px; font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  animation: sldBarRaceIn 1.6s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.sld-bar-fill.without {
  background: linear-gradient(90deg, #94A3B8 0%, #64748B 100%);
}
.sld-bar-fill.with {
  background: linear-gradient(90deg, var(--ezk-blue-deep) 0%, var(--ezk-blue-2) 100%);
  box-shadow: 0 14px 32px -8px rgba(59, 130, 246, 0.45);
}
@keyframes sldBarRaceIn {
  from { width: 0% !important; }
}
.sld-bar-delta {
  display: inline-flex; align-items: center; gap: 12px;
  margin-top: 8px;
  padding: 12px 16px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 12px;
  align-self: flex-start;
}
.sld-bar-delta-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
}
.sld-bar-delta-val {
  font-size: 16px; font-weight: 700;
  color: var(--ezk-ink);
}
.sld-bar-delta-sub {
  font-size: 11.5px;
  color: var(--ezk-mute);
}

/* Time breakdown */
.sld-breakdown {
  display: flex; flex-direction: column; gap: 10px;
  margin-top: 8px;
}
.sld-breakdown-row {
  display: grid;
  grid-template-columns: 280px 1fr 60px;
  gap: 18px; align-items: center;
  font-size: 13.5px;
  color: var(--ezk-ink-2);
}
.sld-breakdown-k { font-weight: 600; }
.sld-breakdown-bar {
  height: 12px;
  background: rgba(15, 23, 42, 0.05);
  border-radius: 999px;
  overflow: hidden;
}
.sld-breakdown-fill {
  height: 100%;
  background: linear-gradient(90deg, #94A3B8 0%, #64748B 100%);
  border-radius: 999px;
  animation: sldBarRaceIn 1.6s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.sld-breakdown-fill.accent {
  background: linear-gradient(90deg, var(--ezk-blue-deep) 0%, var(--ezk-blue-2) 100%);
}
.sld-breakdown-v {
  font-weight: 700;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.sld-breakdown-foot {
  margin-top: 6px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.08em;
  color: var(--ezk-mute);
}

/* Pricing grid (slide 10) */
.sld-pricing-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-top: 8px;
}
.sld-tier {
  position: relative;
  padding: 24px 24px 22px;
  background: #fff;
  border: 1px solid var(--ezk-line);
  border-radius: 18px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 18px 50px -28px rgba(59, 130, 246, 0.22);
}
.sld-tier.is-hero {
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(96, 165, 250, 0.20), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  color: #fff;
  border-color: rgba(96, 165, 250, 0.34);
  box-shadow:
    0 28px 60px -28px rgba(59, 130, 246, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.sld-tier-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue); text-transform: uppercase;
}
.sld-tier.is-hero .sld-tier-tag { color: var(--ezk-blue-2); }
.sld-tier-head { margin: 4px 0 6px; font-size: 18px; font-weight: 600; letter-spacing: -0.018em; color: var(--ezk-ink); }
.sld-tier.is-hero .sld-tier-head { color: #fff; }
.sld-tier-body { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ezk-ink-2); }
.sld-tier.is-hero .sld-tier-body { color: rgba(255, 255, 255, 0.72); }
.sld-tier-foot {
  margin-top: auto; padding-top: 14px;
  display: flex; flex-direction: column; gap: 4px;
}
.sld-tier-v {
  font-size: 38px; font-weight: 700;
  letter-spacing: -0.035em; line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.sld-tier.is-hero .sld-tier-v {
  background: linear-gradient(135deg, #fff 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-tier-when {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; color: var(--ezk-mute); letter-spacing: 0.04em;
}
.sld-tier.is-hero .sld-tier-when { color: rgba(255, 255, 255, 0.60); }

/* Onboarding 3-module strip (slide 11) */
.sld-onb-strip {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 8px;
}
.sld-onb-mod {
  padding: 22px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--ezk-line);
  border-radius: 16px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 18px 40px -22px rgba(59, 130, 246, 0.22);
}
.sld-onb-mod-n {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  padding: 3px 8px;
  border-radius: 6px;
  width: fit-content;
}
.sld-onb-mod-h {
  font-size: 18px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--ezk-ink);
}
.sld-onb-mod-b {
  font-size: 13px; line-height: 1.55;
  color: var(--ezk-ink-2);
}
.sld-onb-mod-time {
  margin-top: auto;
  display: inline-block;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  color: var(--ezk-mute);
  padding: 4px 10px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 999px;
  width: fit-content;
}

/* Agenda strip */
.sld-agenda {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 8px;
}
.sld-agenda-item {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--ezk-line);
  border-radius: 14px;
}
.sld-agenda-n {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 12px; font-weight: 700;
}
.sld-agenda-h {
  font-size: 14.5px; font-weight: 700;
  letter-spacing: -0.014em;
  color: var(--ezk-ink);
}
.sld-agenda-b {
  margin-top: 4px;
  font-size: 12.5px; line-height: 1.5;
  color: var(--ezk-ink-2);
}

/* CTA buttons */
.sld-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  font-size: 14px; font-weight: 600;
  border-radius: 999px;
  border: 0;
  box-shadow: 0 14px 28px -10px rgba(59, 130, 246, 0.45);
  transition: transform .15s ease, box-shadow .15s ease;
}
.sld-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px -10px rgba(59, 130, 246, 0.55);
}
.sld-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--ezk-line-strong);
  color: var(--ezk-ink);
  font-size: 14px; font-weight: 600;
  border-radius: 999px;
  transition: all .15s ease;
}
.sld-btn-ghost:hover {
  background: #fff;
  border-color: var(--ezk-blue);
  color: var(--ezk-blue);
}
.sld-btn-xl { padding: 16px 30px; font-size: 16px; }
.sld-cta-actions {
  display: flex; gap: 12px; flex-wrap: wrap;
  margin-top: 8px;
}

/* RESPONSIVE */
@media (max-width: 980px) {
  .sld-slide { padding: 60px 24px; }
  .sld-grid-hero { grid-template-columns: 1fr; gap: 32px; }
  .sld-hero-right { min-height: 360px; }
  .sld-mock { width: 100%; max-width: 440px; }
  .sld-pillars,
  .sld-pricing-grid,
  .sld-onb-strip,
  .sld-agenda { grid-template-columns: 1fr; }
  .sld-mini-stats,
  .sld-stat-row { grid-template-columns: 1fr 1fr; }
  .sld-agents-viz { grid-template-columns: 1fr; }
  .sld-agents-bus { display: none; }
  .sld-routing { grid-template-columns: 1fr; }
  .sld-routing-arrow { transform: rotate(90deg); }
  .sld-bar-row { grid-template-columns: 1fr; gap: 8px; }
  .sld-breakdown-row { grid-template-columns: 1fr 1fr 60px; }
}
`;
