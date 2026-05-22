'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { EZ_CHECK_COPY, EZ_CHECK_MODULES } from '../../lib/ez-check-theme';

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
  /** When true, the slide chrome flips to the dark-navy backdrop used by
   *  the landing-page deep-dive sections (Smart Form / Signals / Routing
   *  / Patterns / Personas). The slide content cards then use their
   *  dark-glass variants for consistency. */
  dark?: boolean;
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

  /* 07 — SMART FORM · DEEP DIVE (morphing form, conditional logic) */
  {
    n: '07',
    title: 'Smart form · deep dive',
    build: () => (
      <div className="sld-stack sld-grid-hero">
        <div className="sld-hero-left">
          <Reveal>
            <div className="sld-eyebrow">
              <span className="sld-eyebrow-dot" />
              Deep dive · HELIX · Smart form
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="sld-h2">
              <span className="grad-blue-deep">Four ways</span>{' '}
              <span className="grad-blue">the form reshapes itself.</span>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="sld-sub">
              HELIX rewrites field order, validation, and conditional branches on every keystroke.
              The form learns from your funded-deal outcomes — not a generic lookalike. No engineer
              touches it after launch.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <ul className="sld-deep-bullets">
              <li>
                <span className="sld-deep-bullet-tag">CONDITIONAL FIELDS</span>
                <span className="sld-deep-bullet-h">Show only what matters</span>
                <span className="sld-deep-bullet-b">
                  Self-employed → swap W-2 question for bank-statement upload. Budget &lt; $5k →
                  high-ticket qualifying drops entirely.
                </span>
              </li>
              <li>
                <span className="sld-deep-bullet-tag">SOURCE-AWARE ORDER</span>
                <span className="sld-deep-bullet-h">Reorders by traffic source</span>
                <span className="sld-deep-bullet-b">
                  Meta clicks see budget first. Google search clicks see procedure first. Affiliate
                  clicks see attribution first. All learned from your closes.
                </span>
              </li>
              <li>
                <span className="sld-deep-bullet-tag">ABANDONMENT RECOVERY</span>
                <span className="sld-deep-bullet-h">Saves partial answers · 90-day re-pull</span>
                <span className="sld-deep-bullet-b">
                  Bailed at field 3? HELIX emails a one-click resume link. Recoveries close at 2.3×
                  cold-inbound rate.
                </span>
              </li>
              <li>
                <span className="sld-deep-bullet-tag">MOBILE-FIRST</span>
                <span className="sld-deep-bullet-h">One question per screen</span>
                <span className="sld-deep-bullet-b">
                  Auto-advance, inertial keyboards. Buyer finishes a 12-question qualifier before
                  realizing they did.
                </span>
              </li>
            </ul>
          </Reveal>
        </div>
        <div className="sld-hero-right">
          <ParticleField count={14} />
          <TiltCard>
            <MorphingFormDeepMock />
          </TiltCard>
        </div>
      </div>
    ),
  },

  /* 08 — STAGE 2 · PRE-QUAL AGENTS */
  {
    n: '08',
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

  /* 09 — FINANCIAL SIGNALS · DEEP DIVE (the 3 signals ORACLE pulls) */
  {
    n: '09',
    title: 'Three financial signals',
    dark: true,
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Deep dive · ORACLE · Pre-qualification agents
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Three signals.</span>{' '}
            <span className="grad-blue">Composite tier.</span>{' '}
            <span className="grad-blue-deep">Under 3 seconds.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            ORACLE pulls three FCRA / GLBA-compliant data sources in parallel on every form submit
            and composites them into a single tier letter. Name + email + DOB is enough — no manual
            upload needed.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <FinancialSignalsGrid />
        </Reveal>
        <Reveal delay={480}>
          <FundabilityTierStack />
        </Reveal>
      </div>
    ),
  },

  /* 10 — STAGE 3 · SMART ROUTING */
  {
    n: '10',
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

  /* 11 — MULTI-HOP ROUTING TREE (3D visualization) */
  {
    n: '11',
    title: 'Multi-hop routing pipeline',
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Deep dive · HELIX · Routing pipeline
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Routing is a pipeline,</span>{' '}
            <span className="grad-blue">not a single fork.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Chain as many routing decisions as you need. Budget · fundability · time-of-day · source
            · intent — all available as predicates. Each hop is its own A/B test surface.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <MultiHopRoutingTreeDeck />
        </Reveal>
      </div>
    ),
  },

  /* 12 — ROUTING PATTERNS (4 example funnels) */
  {
    n: '12',
    title: 'Real routing patterns',
    dark: true,
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Routing patterns we&apos;ve seen win
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Four real funnels.</span>{' '}
            <span className="grad-blue">Compose your own.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Each card is a live routing pattern from an EZ Check customer. Hops can be added,
            removed, or reordered from the admin panel — no engineer required.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <RoutingPatternsGrid />
        </Reveal>
      </div>
    ),
  },

  /* 13 — PERSONA WALKTHROUGHS (3 buyer journeys) */
  {
    n: '13',
    title: 'Persona walkthroughs',
    dark: true,
    build: () => (
      <div className="sld-stack">
        <Reveal>
          <div className="sld-eyebrow">
            <span className="sld-eyebrow-dot" />
            Three buyers · three paths
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="sld-h2">
            <span className="grad-blue-deep">Same form.</span>{' '}
            <span className="grad-blue">Three outcomes.</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="sld-sub">
            Three buyers hit your funnel in the same hour. Different fundability, different intent,
            finite closer time. Here&apos;s what EZ Check does with each.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <PersonasStrip />
        </Reveal>
      </div>
    ),
  },

  /* 14 — WITHOUT / WITH */
  {
    n: '14',
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
            <Link href="/checkout" className="sld-btn-primary sld-btn-xl">
              Activate now · $5,000 <ArrowIcon />
            </Link>
            <Link href="/" className="sld-btn-ghost sld-btn-xl">
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

/**
 * Pre-qual result mock — sales-deck variant of the landing hero card.
 *
 * Same rich data payload (credit · DTI · income · consumer-direct +
 * merchant-direct funding estimates with BMPO · decline reason · route)
 * but rendered as a presentation-style results panel rather than the
 * landing's app-screen look — different chrome on purpose so the
 * landing page and the deck don't feel like duplicate surfaces.
 *
 * BMPO = Best Monthly Payment Offer, sat directly under each funding
 * line + above the decline-reason row.
 */
function CalendarLandedMock(): JSX.Element {
  return (
    <div className="sld-result">
      <div className="sld-result-head">
        <span className="sld-result-pill">
          <span className="sld-result-pill-dot" />
          Pre-qual result · 2.8s
        </span>
        <span className="sld-result-meta">Illustrative</span>
      </div>

      <div className="sld-result-buyer">
        <div>
          <div className="sld-result-buyer-tag">INBOUND BUYER · PRE-QUALIFIED</div>
          <div className="sld-result-buyer-name">Jordan M.</div>
        </div>
        <div className="sld-result-tier-badge">
          <span className="sld-result-tier-letter">A</span>
          <span className="sld-result-tier-name">Tier · verified</span>
        </div>
      </div>

      <div className="sld-result-signals">
        <div className="sld-result-signal">
          <span className="sld-result-signal-k">Credit score</span>
          <span className="sld-result-signal-v">724</span>
        </div>
        <div className="sld-result-signal">
          <span className="sld-result-signal-k">Available credit</span>
          <span className="sld-result-signal-v">$12.4k</span>
        </div>
        <div className="sld-result-signal">
          <span className="sld-result-signal-k">DTI</span>
          <span className="sld-result-signal-v">22%</span>
        </div>
        <div className="sld-result-signal">
          <span className="sld-result-signal-k">Annual income</span>
          <span className="sld-result-signal-v">$98k</span>
        </div>
      </div>

      <div className="sld-result-funding-head">FUNDING ESTIMATES</div>

      <div className="sld-result-funding-row">
        <div className="sld-result-funding-row-l">
          <span className="sld-result-funding-check is-approved" aria-hidden>
            ✓
          </span>
          <span className="sld-result-funding-label">Consumer-direct</span>
        </div>
        <div className="sld-result-funding-row-r">
          <span className="sld-result-funding-amt">$14,200</span>
          <span className="sld-result-funding-flag is-approved">Pre-approved</span>
        </div>
      </div>
      <div className="sld-result-bmpo">
        <span className="sld-result-bmpo-k">BMPO</span>
        <span className="sld-result-bmpo-v">$295/mo · 60 mo</span>
      </div>

      <div className="sld-result-funding-row">
        <div className="sld-result-funding-row-l">
          <span className="sld-result-funding-check is-approved" aria-hidden>
            ✓
          </span>
          <span className="sld-result-funding-label">Merchant-direct</span>
        </div>
        <div className="sld-result-funding-row-r">
          <span className="sld-result-funding-amt">$18,500</span>
          <span className="sld-result-funding-flag is-approved">Pre-approved</span>
        </div>
      </div>
      <div className="sld-result-bmpo">
        <span className="sld-result-bmpo-k">BMPO</span>
        <span className="sld-result-bmpo-v">$342/mo · 60 mo</span>
      </div>

      <div className="sld-result-decline">
        <span className="sld-result-decline-k">Decline reason</span>
        <span className="sld-result-decline-v">—</span>
      </div>

      <div className="sld-result-footer">Routed → Sarah · Thu 2:00 PM</div>
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

/* =========================== DEEP-DIVE CONTENT ============================ */

/** Smart-form deep-dive · 3D-tilted morphing form with conditional fields
 *  that flag themselves as "HELIX · added" mid-stream. */
function MorphingFormDeepMock(): JSX.Element {
  const FIELDS: Array<{ k: string; v: string; conditional?: boolean }> = [
    { k: 'Email', v: 'jordan@example.com' },
    { k: 'Phone', v: '(415) 555-0192' },
    { k: 'Annual income', v: '$96,000' },
    { k: 'Self-employed?', v: 'Yes', conditional: true },
    { k: 'Bank-statement upload', v: '3 of 3 attached', conditional: true },
    { k: 'Budget range', v: '$10k – $25k' },
  ];
  return (
    <div className="sld-form-deep">
      <div className="sld-form-deep-bezel">
        <div className="sld-form-deep-screen">
          <div className="sld-form-deep-header">
            <span className="sld-form-deep-brand">EZ Check · qualification</span>
            <span className="sld-form-deep-meta">FCRA · 0 impact</span>
          </div>
          <div className="sld-form-deep-title">Quick pre-qual</div>
          <div className="sld-form-deep-sub">HELIX reshapes the form in real time</div>
          <div className="sld-form-deep-fields">
            {FIELDS.map((f, i) => (
              <div
                key={i}
                className={`sld-form-deep-field ${f.conditional ? 'is-conditional' : ''}`}
                style={{ animationDelay: `${i * 0.55}s` }}
              >
                <div className="sld-form-deep-field-k">
                  {f.k}
                  {f.conditional ? (
                    <span className="sld-form-deep-field-flag">HELIX · added</span>
                  ) : null}
                </div>
                <div className="sld-form-deep-field-v">{f.v}</div>
              </div>
            ))}
          </div>
          <div className="sld-form-deep-submit">Submit · run pre-qualification</div>
          <div className="sld-form-deep-foot">
            <span className="sld-form-deep-foot-dot" />
            HELIX added 2 fields based on "self-employed" answer
          </div>
        </div>
      </div>
    </div>
  );
}

/** Three financial signals grid (CREDIT / INCOME / FUNDABILITY). */
function FinancialSignalsGrid(): JSX.Element {
  const SIGNALS = [
    {
      code: '01 · CREDIT',
      head: 'Soft-pull credit score',
      metric: '< 1.2s',
      body: 'Bureau-direct soft inquiry returns score + available credit + utilization. Zero impact, buyer-consented at form submit.',
      points: [
        'Score · available credit · utilization',
        'No hard pull · no permission slip',
        'Bureau-direct API, no aggregators',
      ],
      compliance: 'FCRA · ECOA / Reg B',
    },
    {
      code: '02 · INCOME',
      head: 'Income capacity + DTI',
      metric: '< 0.8s',
      body: 'Verified income via payroll APIs or bank-statement parser. DTI calculated live against the credit-side debt.',
      points: [
        'Gross + net income · verified',
        'DTI vs. credit obligations',
        'Self-employed fallback: bank-statement parser',
      ],
      compliance: 'GLBA · PII tokenized',
    },
    {
      code: '03 · FUNDABILITY',
      head: 'Composite tier',
      metric: 'A / B / C / D',
      body: 'Calibrated on your funded outcomes. Retrained nightly. Every decision shows the exact thresholds it crossed.',
      points: [
        'Trained on your funded deals',
        'Nightly retrain · drift-alerted',
        'Per-decision explanation in audit panel',
      ],
      compliance: 'Model AUC 0.91 · explainable',
    },
  ];
  return (
    <div className="sld-signals-grid">
      {SIGNALS.map((s) => (
        <article key={s.code} className="sld-signal">
          <div className="sld-signal-tag">{s.code}</div>
          <h3 className="sld-signal-h">{s.head}</h3>
          <div className="sld-signal-metric">{s.metric}</div>
          <p className="sld-signal-b">{s.body}</p>
          <ul className="sld-signal-list">
            {s.points.map((pt) => (
              <li key={pt}>
                <span className="sld-signal-check" aria-hidden>
                  ✓
                </span>
                {pt}
              </li>
            ))}
          </ul>
          <div className="sld-signal-foot">
            <span className="sld-signal-foot-k">Compliance</span>
            <span className="sld-signal-foot-v">{s.compliance}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

/** Fundability tier stack — A / B / C / D rows with routing rules. */
function FundabilityTierStack(): JSX.Element {
  const TIERS: Array<{ letter: 'A' | 'B' | 'C' | 'D'; name: string; rule: string }> = [
    { letter: 'A', name: 'Top decile', rule: 'Route → calendar · best closer' },
    { letter: 'B', name: 'Qualified', rule: 'Route → calendar · standard pool' },
    { letter: 'C', name: 'Marginal', rule: 'Route → masterclass · 30-day re-pull' },
    { letter: 'D', name: 'Not fundable', rule: 'Route → nurture · low-ticket offer' },
  ];
  return (
    <div className="sld-tier-stack-wrap">
      <div className="sld-tier-stack-l">
        <div className="sld-tier-stack-tag">COMPOSITE OUTPUT</div>
        <div className="sld-tier-stack-h">Fundability tier · A / B / C / D</div>
        <p className="sld-tier-stack-b">
          The three signals feed a calibrated model retrained nightly on your funded-deal outcomes —
          not a generic lookalike. Every routing decision shows the exact thresholds the buyer
          crossed.
        </p>
      </div>
      <div className="sld-tier-stack-r">
        {TIERS.map((t) => (
          <div key={t.letter} className={`sld-tier-row sld-tier-${t.letter.toLowerCase()}`}>
            <span className="sld-tier-letter">{t.letter}</span>
            <span className="sld-tier-name">{t.name}</span>
            <span className="sld-tier-rule">{t.rule}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Multi-hop routing tree (sales-deck variant) — same shape as the
 *  landing-page tree but scaled to fit a single slide viewport. */
function MultiHopRoutingTreeDeck(): JSX.Element {
  return (
    <div className="sld-tree-scene">
      <div className="sld-tree-plate" aria-hidden />
      <svg
        viewBox="0 0 1000 560"
        preserveAspectRatio="xMidYMid meet"
        className="sld-tree-svg"
        aria-label="Multi-hop routing tree"
      >
        <g className="sld-tree-edges">
          <path d="M500,50 L500,130" />
          <path d="M500,170 L320,250" />
          <path d="M500,170 L680,250" />
          <path d="M320,290 L200,370" />
          <path d="M320,290 L440,370" />
          <path d="M680,290 L560,370" />
          <path d="M680,290 L800,370" />
          <path d="M200,410 L130,490" />
          <path d="M440,410 L370,490" />
          <path d="M560,410 L490,490" />
          <path d="M560,410 L630,490" />
          <path d="M800,410 L750,490" />
          <path d="M800,410 L880,490" />
        </g>
        <path
          id="sld-tree-trace"
          d="M500,50 L500,170 L680,250 L680,290 L800,370 L800,410 L750,490"
          fill="none"
          stroke="transparent"
        />
        <circle r="7" className="sld-tree-buyer">
          <animateMotion dur="6.5s" repeatCount="indefinite" rotate="auto">
            <mpath href="#sld-tree-trace" />
          </animateMotion>
        </circle>
        {[
          { x: 440, y: 12, tag: 'LEAD CAPTURE', h: 'Form submit', cls: 'sld-tree-node-root' },
          { x: 440, y: 132, tag: 'HOP 1 · BUDGET', h: '≥ $10k?', cls: 'sld-tree-node-gate' },
          { x: 260, y: 252, tag: 'HOP 2 · TIER', h: 'A / B / C / D?', cls: 'sld-tree-node-gate' },
          {
            x: 620,
            y: 252,
            tag: 'HOP 2 · INTENT',
            h: 'Hot · warm · cold',
            cls: 'sld-tree-node-gate',
          },
          {
            x: 140,
            y: 372,
            tag: 'HOP 3 · CALENDAR',
            h: 'Senior · standard',
            cls: 'sld-tree-node-gate',
          },
          {
            x: 380,
            y: 372,
            tag: 'HOP 3 · OFFER',
            h: 'Masterclass · ebook',
            cls: 'sld-tree-node-gate',
          },
          {
            x: 500,
            y: 372,
            tag: 'HOP 3 · WEBINAR',
            h: 'Live · recorded',
            cls: 'sld-tree-node-gate',
          },
          {
            x: 740,
            y: 372,
            tag: 'HOP 3 · CALENDAR',
            h: 'Senior · standard',
            cls: 'sld-tree-node-gate sld-tree-node-traced',
          },
          { x: 70, y: 492, tag: 'TERMINAL', h: 'Calendar · senior', cls: 'sld-tree-node-term' },
          { x: 310, y: 492, tag: 'TERMINAL', h: 'Masterclass', cls: 'sld-tree-node-term' },
          { x: 430, y: 492, tag: 'TERMINAL', h: 'Webinar live', cls: 'sld-tree-node-term' },
          { x: 570, y: 492, tag: 'TERMINAL', h: 'Webinar replay', cls: 'sld-tree-node-term' },
          {
            x: 690,
            y: 492,
            tag: 'TERMINAL',
            h: 'Calendar · senior',
            cls: 'sld-tree-node-term sld-tree-node-traced',
          },
          { x: 820, y: 492, tag: 'TERMINAL', h: 'Calendar · standard', cls: 'sld-tree-node-term' },
        ].map((n, i) => (
          <g key={i} transform={`translate(${n.x}, ${n.y})`}>
            <rect className={`sld-tree-node ${n.cls}`} width="120" height="38" rx="10" />
            <text className="sld-tree-node-tag" x="60" y="16">
              {n.tag}
            </text>
            <text className="sld-tree-node-h" x="60" y="32">
              {n.h}
            </text>
          </g>
        ))}
      </svg>
      <div className="sld-tree-legend">
        <div>
          <span className="sld-tree-legend-dot sld-tree-legend-dot-buyer" />
          Animated dot = a Tier-A buyer flowing through the pipeline
        </div>
        <div>
          <span className="sld-tree-legend-dot sld-tree-legend-dot-edge" />
          Dashed edges = your A/B-test surfaces · solid = live rules
        </div>
      </div>
    </div>
  );
}

/** Routing pattern cards (4 real funnels). */
function RoutingPatternsGrid(): JSX.Element {
  const PATTERNS = [
    {
      tag: 'BUDGET-GATED · 4 HOPS',
      head: 'Coaching · $10k+ programs',
      body: 'Meta delivers buyers who lie about budget once they hear the price. Gate on stated budget before spending a soft pull.',
      hops: [
        { h: 'Lead capture', b: 'Email + phone + UTM' },
        { h: 'Budget gate', b: '≥ $10k → continue · < $10k → masterclass' },
        { h: 'Pre-qual pull', b: 'ORACLE · 3 signals' },
        { h: 'Tier gate', b: 'A/B → calendar · C → nurture' },
      ],
      outcome: 'Tier-A/B booked on senior closer in 60 seconds.',
    },
    {
      tag: 'INTENT CASCADE · 5 HOPS',
      head: 'B2B SaaS demo funnel',
      body: 'Keep narrowing the field at every hop instead of dumping everything onto the AE calendar.',
      hops: [
        { h: 'Lead capture', b: 'Work email + role + company' },
        { h: 'Company-size gate', b: '≥ 50 emp → continue · SMB → trial' },
        { h: 'Role gate', b: 'VP/Director → continue · IC → case studies' },
        { h: 'Intent score', b: 'Pricing + docs + return → demo · cold → webinar' },
        { h: 'AE match', b: 'Routed to territory owner · round-robin fallback' },
      ],
      outcome: 'Enterprise AE calendar fills only with ICP-fit buyers.',
    },
    {
      tag: 'TIME-AWARE · 3 HOPS',
      head: 'Local services · roofing + solar',
      body: 'Flip the routing destination on time-of-day — Friday-night leads do not land on Monday-morning calendars.',
      hops: [
        { h: 'Lead capture', b: 'Address + project + photo' },
        { h: 'Working-hours gate', b: '9–7 → live call · after-hours → AM callback' },
        { h: 'Service-area gate', b: 'In-zone → estimator · out-of-zone → partner referral' },
      ],
      outcome: 'Live calls in &lt; 90s during business hours. Zero overnight ghosts.',
    },
    {
      tag: 'SOURCE-ATTRIBUTED · 4 HOPS',
      head: 'Med-spa cosmetic consults',
      body: 'Meta wants speed-of-quote. Google search wants authority. Affiliate wants their own attribution. Branch on UTM first.',
      hops: [
        { h: 'Lead capture', b: 'Procedure + photo + ad-creative ID' },
        {
          h: 'Source gate',
          b: 'Meta → instant-quote · Google → reviews · affiliate → partner-branded',
        },
        { h: 'Pre-qual pull', b: 'ORACLE: credit + income' },
        { h: 'Closer match', b: 'Rep who closes that procedure best' },
      ],
      outcome: 'Per-source close-rate visible live · spend reallocates weekly.',
    },
  ];
  return (
    <div className="sld-patterns-grid">
      {PATTERNS.map((p, idx) => (
        <article key={idx} className="sld-pattern">
          <div className="sld-pattern-tag">{p.tag}</div>
          <h3 className="sld-pattern-h">{p.head}</h3>
          <p className="sld-pattern-b">{p.body}</p>
          <ol className="sld-pattern-hops">
            {p.hops.map((h, i) => (
              <li key={i}>
                <span className="sld-pattern-hop-n">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="sld-pattern-hop-h">{h.h}</span>
                  <span className="sld-pattern-hop-b">{h.b}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="sld-pattern-outcome">
            <span className="sld-pattern-outcome-tag">TERMINAL</span>
            <span className="sld-pattern-outcome-v">{p.outcome}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

/** Persona walkthroughs — 3 buyer journeys side-by-side. */
function PersonasStrip(): JSX.Element {
  // Same rich pre-qual payload the landing-page persona cards carry —
  // credit / available / DTI / income / consumer + merchant direct
  // funding (with BMPO + pre-approved flags) / decline reason.
  const PERSONAS: Array<{
    name: string;
    initials: string;
    tier: 'A' | 'B' | 'C';
    source: string;
    signals: { creditScore: string; availableCredit: string; dti: string; income: string };
    consumer: { preApproved: boolean; estimate: string; bmpo: string };
    merchant: { preApproved: boolean; estimate: string; bmpo: string };
    decline: string;
    path: Array<{ h: string; b: string }>;
    outcomeTag: string;
    outcome: string;
  }> = [
    {
      name: 'Jordan M.',
      initials: 'JM',
      tier: 'A',
      source: 'Meta · creative #042',
      signals: { creditScore: '724', availableCredit: '$12.4k', dti: '22%', income: '$98k' },
      consumer: { preApproved: true, estimate: '$14,200', bmpo: '$295/mo · 60 mo' },
      merchant: { preApproved: true, estimate: '$18,500', bmpo: '$342/mo · 60 mo' },
      decline: '—',
      path: [
        { h: 'Form submit', b: '4 of 6 fast-path questions in 41s' },
        { h: 'Budget gate', b: '$15k stated → continue' },
        { h: 'ORACLE pull', b: '3 signals back in 2.8s · both rails pre-approved' },
        { h: 'Tier composite', b: 'Tier A · top decile' },
        { h: 'Routed', b: 'Senior closer · Thu 2:00 PM' },
      ],
      outcomeTag: 'CALENDAR',
      outcome: 'Booked senior closer · 41s form → 60s route',
    },
    {
      name: 'Alex S.',
      initials: 'AS',
      tier: 'B',
      source: 'Google · best-coaching search',
      signals: { creditScore: '688', availableCredit: '$7.2k', dti: '31%', income: '$72k' },
      consumer: { preApproved: true, estimate: '$8,400', bmpo: '$198/mo · 60 mo' },
      merchant: { preApproved: true, estimate: '$11,200', bmpo: '$238/mo · 60 mo' },
      decline: '—',
      path: [
        { h: 'Form submit', b: 'Reviews-flow variant · 6 fields' },
        { h: 'Budget gate', b: '$8k < high-ticket → masterclass route' },
        { h: 'ORACLE pull', b: 'Both rails approved · stated budget under threshold' },
        { h: 'Routed', b: 'Live workshop · 30-day re-pull' },
      ],
      outcomeTag: 'MASTERCLASS',
      outcome: 'Live workshop · auto re-pull in 30 days',
    },
    {
      name: 'Casey R.',
      initials: 'CR',
      tier: 'C',
      source: 'Affiliate · partner #018',
      signals: { creditScore: '598', availableCredit: '$1.2k', dti: '51%', income: '$44k' },
      consumer: { preApproved: false, estimate: '$0', bmpo: '—' },
      merchant: { preApproved: true, estimate: '$3,500', bmpo: '$98/mo · 48 mo' },
      decline: 'Consumer-direct lenders require DTI < 45%',
      path: [
        { h: 'Form submit', b: 'Bailed at field 3 · recovered 6h later' },
        { h: 'Budget gate', b: '$3k < threshold → low-ticket flow' },
        { h: 'ORACLE pull', b: 'Consumer-direct declined · merchant-direct still open' },
        { h: 'Tier composite', b: 'Tier C · partial via merchant-direct' },
        { h: 'Routed', b: 'Free-guide + 90-day re-pull · merchant offer kept' },
      ],
      outcomeTag: 'NURTURE',
      outcome: 'Never touched closer · merchant-direct kept the option open',
    },
  ];
  return (
    <div className="sld-personas-grid">
      {PERSONAS.map((p) => (
        <article key={p.name} className={`sld-persona sld-persona-${p.tier.toLowerCase()}`}>
          <div className="sld-persona-head">
            <div className="sld-persona-avatar">{p.initials}</div>
            <div>
              <div className="sld-persona-name">{p.name}</div>
              <div className="sld-persona-source">{p.source}</div>
            </div>
            <div className="sld-persona-tier-pill">Tier {p.tier}</div>
          </div>
          <div className="sld-persona-signals">
            <div className="sld-persona-signal">
              <span className="sld-persona-signal-k">Credit</span>
              <span className="sld-persona-signal-v">{p.signals.creditScore}</span>
            </div>
            <div className="sld-persona-signal">
              <span className="sld-persona-signal-k">Available</span>
              <span className="sld-persona-signal-v">{p.signals.availableCredit}</span>
            </div>
            <div className="sld-persona-signal">
              <span className="sld-persona-signal-k">DTI</span>
              <span className="sld-persona-signal-v">{p.signals.dti}</span>
            </div>
            <div className="sld-persona-signal">
              <span className="sld-persona-signal-k">Income</span>
              <span className="sld-persona-signal-v">{p.signals.income}</span>
            </div>
          </div>
          <div className="sld-persona-funding">
            <div className="sld-persona-funding-row">
              <div className="sld-persona-funding-l">
                <span
                  className={`sld-persona-funding-check ${
                    p.consumer.preApproved ? 'is-approved' : 'is-declined'
                  }`}
                  aria-hidden
                >
                  {p.consumer.preApproved ? '✓' : '×'}
                </span>
                <span className="sld-persona-funding-label">Consumer-direct</span>
              </div>
              <div className="sld-persona-funding-r">
                <span className="sld-persona-funding-amt">{p.consumer.estimate}</span>
                <span
                  className={`sld-persona-funding-flag ${
                    p.consumer.preApproved ? 'is-approved' : 'is-declined'
                  }`}
                >
                  {p.consumer.preApproved ? 'Pre-approved' : 'Declined'}
                </span>
              </div>
            </div>
            <div className="sld-persona-bmpo">
              <span className="sld-persona-bmpo-k">BMPO</span>
              <span className="sld-persona-bmpo-v">{p.consumer.bmpo}</span>
            </div>
            <div className="sld-persona-funding-row">
              <div className="sld-persona-funding-l">
                <span
                  className={`sld-persona-funding-check ${
                    p.merchant.preApproved ? 'is-approved' : 'is-declined'
                  }`}
                  aria-hidden
                >
                  {p.merchant.preApproved ? '✓' : '×'}
                </span>
                <span className="sld-persona-funding-label">Merchant-direct</span>
              </div>
              <div className="sld-persona-funding-r">
                <span className="sld-persona-funding-amt">{p.merchant.estimate}</span>
                <span
                  className={`sld-persona-funding-flag ${
                    p.merchant.preApproved ? 'is-approved' : 'is-declined'
                  }`}
                >
                  {p.merchant.preApproved ? 'Pre-approved' : 'Declined'}
                </span>
              </div>
            </div>
            <div className="sld-persona-bmpo">
              <span className="sld-persona-bmpo-k">BMPO</span>
              <span className="sld-persona-bmpo-v">{p.merchant.bmpo}</span>
            </div>
            <div className="sld-persona-decline">
              <span className="sld-persona-decline-k">Decline reason</span>
              <span className="sld-persona-decline-v">{p.decline}</span>
            </div>
          </div>
          <ol className="sld-persona-path">
            {p.path.map((step, i) => (
              <li key={i} className={i === p.path.length - 1 ? 'is-terminal' : ''}>
                <span className="sld-persona-path-dot" />
                <span className="sld-persona-path-h">{step.h}</span>
                <span className="sld-persona-path-b">{step.b}</span>
              </li>
            ))}
          </ol>
          <div className="sld-persona-outcome">
            <span className="sld-persona-outcome-tag">{p.outcomeTag}</span>
            <span className="sld-persona-outcome-v">{p.outcome}</span>
          </div>
        </article>
      ))}
    </div>
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
            className={`sld-slide ${s.dark ? 'sld-slide-dark' : ''}`}
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

/* ============================ PRE-QUAL RESULT · DECK =====================
 * Sales-deck variant of the hero result card. Same data payload as the
 * landing-page version but rendered as a "results console" — darker
 * border, console-monospace numerals, and a navy gradient header bar
 * so it reads as a presentation panel rather than an app screen.
 */
.sld-result {
  position: relative;
  width: 100%;
  max-width: 460px;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.10), transparent 65%),
    rgba(255, 255, 255, 0.98);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 20px;
  padding: 22px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.55),
    0 30px 60px -30px rgba(59, 130, 246, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  overflow: hidden;
}
.sld-result::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--ezk-blue-deep), var(--ezk-blue-2), var(--ezk-blue-deep));
}

/* HEAD */
.sld-result-head {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 4px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ezk-line);
}
.sld-result-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(96, 165, 250, 0.14);
  border-radius: 999px;
}
.sld-result-pill-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--ezk-blue-2);
  animation: sldPulse 1.6s ease-in-out infinite;
}
.sld-result-meta {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8.5px; letter-spacing: 0.18em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}

/* BUYER */
.sld-result-buyer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 14px;
}
.sld-result-buyer-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-result-buyer-name {
  margin-top: 4px;
  font-size: 26px; font-weight: 800;
  letter-spacing: -0.026em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.sld-result-tier-badge {
  display: inline-flex; flex-direction: column; align-items: center;
  padding: 7px 12px;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  border-radius: 12px;
  color: #fff;
  box-shadow: 0 8px 20px -8px rgba(59, 130, 246, 0.55);
}
.sld-result-tier-letter {
  font-size: 20px; font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
}
.sld-result-tier-name {
  margin-top: 2px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8px; letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.78);
}

/* SIGNALS GRID — 4 cells, single row */
.sld-result-signals {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin-top: 14px;
  background: var(--ezk-line);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--ezk-line);
}
.sld-result-signal {
  background: rgba(255, 255, 255, 0.97);
  padding: 11px 6px;
  display: flex; flex-direction: column; gap: 4px;
  align-items: center;
  text-align: center;
}
.sld-result-signal-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8px; letter-spacing: 0.10em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-result-signal-v {
  font-size: 16px; font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* FUNDING */
.sld-result-funding-head {
  margin-top: 16px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-result-funding-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 10px;
}
.sld-result-funding-row-l {
  display: inline-flex; align-items: center; gap: 8px;
}
.sld-result-funding-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  font-size: 10.5px; font-weight: 700;
}
.sld-result-funding-check.is-approved {
  background: rgba(96, 165, 250, 0.20);
  color: var(--ezk-blue);
}
.sld-result-funding-check.is-declined {
  background: rgba(167, 139, 250, 0.22);
  color: #6D28D9;
}
.sld-result-funding-label {
  font-size: 13px; font-weight: 600;
  color: var(--ezk-ink);
}
.sld-result-funding-row-r {
  display: inline-flex; align-items: center; gap: 10px;
}
.sld-result-funding-amt {
  font-size: 15px; font-weight: 700;
  letter-spacing: -0.016em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: right;
}
.sld-result-funding-flag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8.5px; letter-spacing: 0.14em; font-weight: 700;
  padding: 3px 6px;
  border-radius: 5px;
  text-transform: uppercase;
  min-width: 80px;
  text-align: center;
}
.sld-result-funding-flag.is-approved {
  background: rgba(96, 165, 250, 0.16);
  color: var(--ezk-blue);
  border: 1px solid rgba(59, 130, 246, 0.28);
}
.sld-result-funding-flag.is-declined {
  background: rgba(167, 139, 250, 0.16);
  color: #6D28D9;
  border: 1px solid rgba(167, 139, 250, 0.34);
}
.sld-result-bmpo {
  display: flex; justify-content: space-between; align-items: center;
  margin-left: 26px;
  margin-top: 3px;
  padding: 5px 10px;
  background: rgba(59, 130, 246, 0.04);
  border-left: 2px solid rgba(96, 165, 250, 0.45);
  border-radius: 0 5px 5px 0;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px;
}
.sld-result-bmpo-k {
  color: var(--ezk-mute);
  font-weight: 700;
  letter-spacing: 0.06em;
}
.sld-result-bmpo-v {
  color: var(--ezk-blue);
  font-weight: 700;
}

/* DECLINE */
.sld-result-decline {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px dashed var(--ezk-line);
  gap: 14px;
}
.sld-result-decline-k {
  flex-shrink: 0;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-result-decline-v {
  font-size: 12px;
  color: var(--ezk-ink-2);
  font-weight: 600;
  text-align: right;
}

/* FOOTER */
.sld-result-footer {
  margin-top: 14px;
  padding: 12px 14px;
  text-align: center;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  border-radius: 10px;
  font-size: 12.5px; font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 12px 28px -12px rgba(59, 130, 246, 0.55);
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

/* ========================== DEEP-DIVE SLIDES =============================== */

/* SMART FORM DEEP DIVE — bullets + tilted morphing form */
.sld-deep-bullets {
  list-style: none; padding: 0; margin: 8px 0 0;
  display: flex; flex-direction: column;
  gap: 10px;
}
.sld-deep-bullets li {
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--ezk-line);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 4px;
  box-shadow: 0 18px 40px -22px rgba(59, 130, 246, 0.22);
  transition: transform .25s ease, box-shadow .25s ease;
}
.sld-deep-bullets li:hover {
  transform: translateX(4px);
  box-shadow: 0 28px 56px -22px rgba(59, 130, 246, 0.35);
}
.sld-deep-bullet-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
}
.sld-deep-bullet-h {
  font-size: 15px; font-weight: 600;
  letter-spacing: -0.014em;
  color: var(--ezk-ink);
}
.sld-deep-bullet-b {
  margin-top: 2px;
  font-size: 12.5px; line-height: 1.5;
  color: var(--ezk-ink-2);
}

/* MORPHING FORM — sales-deck variant */
.sld-form-deep {
  position: relative; z-index: 2;
  width: 420px;
}
.sld-form-deep-bezel {
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  padding: 14px;
  border-radius: 22px;
  box-shadow:
    0 60px 110px -50px rgba(59, 130, 246, 0.55),
    0 30px 60px -30px rgba(59, 130, 246, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.sld-form-deep-screen {
  background: #fff;
  border-radius: 14px;
  padding: 22px;
}
.sld-form-deep-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ezk-line);
}
.sld-form-deep-brand {
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
}
.sld-form-deep-meta {
  font-size: 9px; letter-spacing: 0.16em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.sld-form-deep-title {
  margin-top: 14px;
  font-size: 20px; font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ezk-ink);
}
.sld-form-deep-sub {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--ezk-mute);
}
.sld-form-deep-fields {
  margin-top: 14px;
  display: flex; flex-direction: column;
  gap: 7px;
}
.sld-form-deep-field {
  display: flex; flex-direction: column;
  gap: 3px;
  padding: 10px 14px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid var(--ezk-line);
  border-radius: 10px;
  opacity: 0;
  animation: sldFieldIn 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
.sld-form-deep-field.is-conditional {
  background: rgba(96, 165, 250, 0.12);
  border-color: rgba(96, 165, 250, 0.40);
  box-shadow: 0 6px 16px -8px rgba(59, 130, 246, 0.30);
}
.sld-form-deep-field-k {
  display: flex; align-items: center; gap: 8px;
  font-size: 9.5px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-form-deep-field-flag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--ezk-blue);
  padding: 2px 6px;
  background: rgba(59, 130, 246, 0.10);
  border-radius: 4px;
  text-transform: uppercase;
}
.sld-form-deep-field-v {
  font-size: 13px; font-weight: 600;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.sld-form-deep-submit {
  margin-top: 14px;
  padding: 11px;
  text-align: center;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  border-radius: 10px;
  font-size: 13px; font-weight: 700;
}
.sld-form-deep-foot {
  margin-top: 10px;
  display: flex; align-items: center; gap: 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.04em;
  color: var(--ezk-mute);
}
.sld-form-deep-foot-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--ezk-blue);
  animation: sldPulse 1.6s ease-in-out infinite;
}

/* FINANCIAL SIGNALS GRID */
.sld-signals-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 4px;
  perspective: 1400px;
  align-items: stretch;
}
.sld-signal {
  position: relative;
  padding: 22px;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.10), transparent 65%),
    rgba(255, 255, 255, 0.97);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 18px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.28);
  transition: transform .35s ease, box-shadow .35s ease;
  display: flex; flex-direction: column; gap: 6px;
}
.sld-signal:hover {
  transform: translateY(-4px) rotateX(2deg);
  box-shadow: 0 36px 70px -28px rgba(59, 130, 246, 0.40);
}
.sld-signal-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
  padding: 3px 8px;
  width: fit-content;
  text-transform: uppercase;
}
.sld-signal-h {
  margin: 8px 0 0;
  font-size: 18px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--ezk-ink);
}
.sld-signal-metric {
  margin-top: 4px;
  font-size: 28px; font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-signal-b {
  margin: 6px 0 0;
  font-size: 12.5px; line-height: 1.5;
  color: var(--ezk-ink-2);
}
.sld-signal-list {
  list-style: none; padding: 0; margin: 12px 0 0;
  display: flex; flex-direction: column; gap: 5px;
}
.sld-signal-list li {
  display: grid; grid-template-columns: 16px 1fr;
  gap: 8px; align-items: start;
  font-size: 12px; line-height: 1.45;
  color: var(--ezk-ink-2);
}
.sld-signal-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.18);
  color: var(--ezk-blue);
  font-size: 9px; font-weight: 700;
  margin-top: 2px;
}
.sld-signal-foot {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--ezk-line);
  display: flex; flex-direction: column; gap: 2px;
}
.sld-signal-foot-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-signal-foot-v {
  font-size: 11px;
  color: var(--ezk-blue);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}

/* FUNDABILITY TIER STACK */
.sld-tier-stack-wrap {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  align-items: center;
  margin-top: 4px;
  padding: 24px;
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(96, 165, 250, 0.16), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  border-radius: 22px;
  color: #fff;
  box-shadow:
    0 28px 60px -28px rgba(59, 130, 246, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.sld-tier-stack-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue-2);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.sld-tier-stack-h {
  margin: 0 0 8px;
  font-size: 22px; font-weight: 600;
  letter-spacing: -0.022em;
  color: #fff;
}
.sld-tier-stack-b {
  margin: 0;
  font-size: 13.5px; line-height: 1.55;
  color: rgba(255, 255, 255, 0.78);
}
.sld-tier-stack-r { display: flex; flex-direction: column; gap: 6px; }
.sld-tier-row {
  display: grid; grid-template-columns: 32px 96px 1fr;
  gap: 12px; align-items: center;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
}
.sld-tier-letter {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border-radius: 7px;
  font-size: 14px; font-weight: 800;
  color: #fff;
}
.sld-tier-a .sld-tier-letter { background: linear-gradient(135deg, #3B82F6, #60A5FA); }
.sld-tier-b .sld-tier-letter { background: linear-gradient(135deg, #93C5FD, #60A5FA); }
.sld-tier-c .sld-tier-letter { background: linear-gradient(135deg, #A78BFA, #8B5CF6); }
.sld-tier-d .sld-tier-letter { background: linear-gradient(135deg, #64748B, #475569); }
.sld-tier-name {
  font-size: 12px; font-weight: 700;
  color: #fff;
}
.sld-tier-rule {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.74);
}

/* MULTI-HOP ROUTING TREE — sales-deck variant */
.sld-tree-scene {
  position: relative;
  margin-top: 8px;
  padding: 14px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 20px;
  overflow: hidden;
}
.sld-tree-plate {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 60% 60% at 50% 0%, rgba(96, 165, 250, 0.22), transparent 60%),
    radial-gradient(ellipse 50% 50% at 50% 100%, rgba(59, 130, 246, 0.16), transparent 55%);
  pointer-events: none;
}
.sld-tree-svg {
  position: relative; z-index: 1;
  width: 100%;
  height: auto;
  max-height: 480px;
  display: block;
  transform: perspective(1800px) rotateX(6deg);
  transform-origin: 50% 50%;
}
.sld-tree-edges path {
  fill: none;
  stroke: rgba(59, 130, 246, 0.55);
  stroke-width: 1.6;
  stroke-dasharray: 5 5;
  animation: sldEdgeDash 8s linear infinite;
}
@keyframes sldEdgeDash {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -100; }
}
.sld-tree-node {
  fill: rgba(255, 255, 255, 0.97);
  stroke: rgba(59, 130, 246, 0.40);
  stroke-width: 1.4;
}
.sld-tree-node-root {
  fill: #1E3A8A;
  stroke: rgba(96, 165, 250, 0.65);
}
.sld-tree-node-gate {
  fill: rgba(255, 255, 255, 0.98);
  stroke: rgba(59, 130, 246, 0.45);
}
.sld-tree-node-term {
  fill: rgba(255, 255, 255, 0.98);
  stroke: rgba(59, 130, 246, 0.34);
}
.sld-tree-node-traced {
  stroke: rgba(96, 165, 250, 1);
  stroke-width: 2.2;
  filter: drop-shadow(0 0 10px rgba(96, 165, 250, 0.55));
}
.sld-tree-node-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 7px;
  letter-spacing: 0.16em;
  font-weight: 700;
  fill: var(--ezk-blue);
  text-anchor: middle;
  text-transform: uppercase;
}
.sld-tree-node-root + .sld-tree-node-tag,
.sld-tree-node-root ~ .sld-tree-node-tag {
  fill: rgba(255, 255, 255, 0.95);
}
g .sld-tree-node-root ~ text.sld-tree-node-tag,
g .sld-tree-node-root + text.sld-tree-node-tag {
  fill: rgba(96, 165, 250, 0.95);
}
.sld-tree-node-h {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  fill: var(--ezk-ink);
  text-anchor: middle;
}
.sld-tree-svg g:first-of-type ~ g .sld-tree-node-root + text {
  fill: #fff;
}
.sld-tree-buyer {
  fill: #A78BFA;
  filter: drop-shadow(0 0 6px #A78BFA);
}
.sld-tree-legend {
  position: relative; z-index: 2;
  margin-top: 12px;
  display: flex; flex-wrap: wrap; gap: 18px;
  font-size: 11.5px;
  color: var(--ezk-ink-2);
}
.sld-tree-legend > div {
  display: inline-flex; align-items: center; gap: 8px;
}
.sld-tree-legend-dot { width: 9px; height: 9px; border-radius: 999px; }
.sld-tree-legend-dot-buyer { background: #A78BFA; box-shadow: 0 0 6px #A78BFA; }
.sld-tree-legend-dot-edge { background: var(--ezk-blue); box-shadow: 0 0 6px rgba(59, 130, 246, 0.5); }

/* ROUTING PATTERN CARDS — 2x2 grid */
.sld-patterns-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  grid-auto-rows: 1fr;
  gap: 14px;
  margin-top: 4px;
  align-items: stretch;
}
.sld-pattern {
  padding: 20px;
  background:
    radial-gradient(ellipse 70% 60% at 0% 0%, rgba(96, 165, 250, 0.08), transparent 65%),
    rgba(255, 255, 255, 0.97);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 16px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.22);
  transition: transform .25s ease, box-shadow .25s ease;
  display: flex; flex-direction: column;
}
.sld-pattern:hover {
  transform: translateY(-3px);
  box-shadow: 0 32px 70px -28px rgba(59, 130, 246, 0.35);
}
.sld-pattern-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
}
.sld-pattern-h {
  margin: 6px 0 6px;
  font-size: 17px; font-weight: 600;
  letter-spacing: -0.016em;
  color: var(--ezk-ink);
}
.sld-pattern-b {
  margin: 0 0 12px;
  font-size: 12.5px; line-height: 1.5;
  color: var(--ezk-ink-2);
}
.sld-pattern-hops {
  list-style: none; padding: 10px; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid var(--ezk-line);
  flex: 1;
  border-radius: 10px;
}
.sld-pattern-hops li {
  display: grid; grid-template-columns: 26px 1fr;
  gap: 8px; align-items: start;
}
.sld-pattern-hop-n {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(59, 130, 246, 0.10);
  border-radius: 4px;
  padding: 3px 0;
  text-align: center;
}
.sld-pattern-hop-h {
  display: block;
  font-size: 12.5px; font-weight: 600;
  color: var(--ezk-ink);
}
.sld-pattern-hop-b {
  display: block;
  margin-top: 1px;
  font-size: 11.5px; line-height: 1.4;
  color: var(--ezk-mute);
}
.sld-pattern-outcome {
  margin-top: 12px;
  padding: 11px 14px;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  border-radius: 10px;
  color: #fff;
  display: flex; flex-direction: column; gap: 2px;
}
.sld-pattern-outcome-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue-2);
  text-transform: uppercase;
}
.sld-pattern-outcome-v {
  font-size: 12.5px; font-weight: 600;
}

/* PERSONA WALKTHROUGHS — 3 cards side-by-side */
.sld-personas-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 4px;
  align-items: stretch;
}
.sld-persona {
  padding: 20px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 16px;
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.22);
  display: flex; flex-direction: column;
  transition: transform .25s ease, box-shadow .25s ease;
}
.sld-persona:hover {
  transform: translateY(-3px);
  box-shadow: 0 32px 70px -28px rgba(59, 130, 246, 0.35);
}
.sld-persona-head {
  display: grid; grid-template-columns: 40px 1fr auto;
  gap: 10px; align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ezk-line);
}
.sld-persona-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px;
  border-radius: 10px;
  color: #fff;
  font-size: 14px; font-weight: 800;
}
.sld-persona-a .sld-persona-avatar { background: linear-gradient(135deg, #3B82F6, #60A5FA); }
.sld-persona-b .sld-persona-avatar { background: linear-gradient(135deg, #93C5FD, #60A5FA); }
.sld-persona-c .sld-persona-avatar { background: linear-gradient(135deg, #A78BFA, #8B5CF6); }
.sld-persona-name {
  font-size: 14px; font-weight: 700;
  color: var(--ezk-ink);
}
.sld-persona-source {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px;
  color: var(--ezk-mute);
}
.sld-persona-tier-pill {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(59, 130, 246, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.25);
  padding: 3px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}
.sld-persona-c .sld-persona-tier-pill {
  color: #6D28D9;
  background: rgba(167, 139, 250, 0.14);
  border-color: rgba(167, 139, 250, 0.35);
}
.sld-persona-stats {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  margin: 14px 0;
  padding: 10px;
  background: rgba(59, 130, 246, 0.04);
  border-radius: 8px;
}
.sld-persona-stat {
  display: flex; flex-direction: column; gap: 2px; align-items: center;
}
.sld-persona-stat-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.14em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-persona-stat-v {
  font-size: 14px; font-weight: 700;
  letter-spacing: -0.012em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}

/* PERSONA SIGNALS GRID — 4-up financial signals */
.sld-persona-signals {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin: 12px 0 10px;
  background: var(--ezk-line);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--ezk-line);
}
.sld-persona-signal {
  background: rgba(255, 255, 255, 0.97);
  padding: 8px 4px;
  display: flex; flex-direction: column; gap: 2px; align-items: center;
  text-align: center;
}
.sld-persona-signal-k {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 7.5px; letter-spacing: 0.10em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-persona-signal-v {
  font-size: 13px; font-weight: 800;
  letter-spacing: -0.014em;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* PERSONA FUNDING — consumer + merchant rails + BMPO + decline */
.sld-persona-funding {
  padding: 10px 12px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid var(--ezk-line);
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex; flex-direction: column; gap: 5px;
}
.sld-persona-funding-row {
  display: flex; justify-content: space-between; align-items: center;
}
.sld-persona-funding-l { display: inline-flex; align-items: center; gap: 7px; }
.sld-persona-funding-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px;
  border-radius: 999px;
  font-size: 9.5px; font-weight: 700;
}
.sld-persona-funding-check.is-approved {
  background: rgba(96, 165, 250, 0.22);
  color: var(--ezk-blue);
}
.sld-persona-funding-check.is-declined {
  background: rgba(167, 139, 250, 0.22);
  color: #6D28D9;
}
.sld-persona-funding-label {
  font-size: 12px; font-weight: 600;
  color: var(--ezk-ink);
}
.sld-persona-funding-r { display: inline-flex; align-items: center; gap: 7px; }
.sld-persona-funding-amt {
  font-size: 12.5px; font-weight: 700;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.sld-persona-funding-flag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8px; letter-spacing: 0.12em; font-weight: 700;
  padding: 2px 5px;
  border-radius: 4px;
  text-transform: uppercase;
}
.sld-persona-funding-flag.is-approved {
  background: rgba(96, 165, 250, 0.16);
  color: var(--ezk-blue);
  border: 1px solid rgba(59, 130, 246, 0.28);
}
.sld-persona-funding-flag.is-declined {
  background: rgba(167, 139, 250, 0.16);
  color: #6D28D9;
  border: 1px solid rgba(167, 139, 250, 0.34);
}
.sld-persona-bmpo {
  display: flex; justify-content: space-between; align-items: center;
  margin-left: 22px;
  padding: 3px 8px;
  background: rgba(59, 130, 246, 0.06);
  border-left: 2px solid rgba(96, 165, 250, 0.45);
  border-radius: 0 4px 4px 0;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px;
}
.sld-persona-bmpo-k {
  color: var(--ezk-mute);
  font-weight: 700;
  letter-spacing: 0.06em;
}
.sld-persona-bmpo-v {
  color: var(--ezk-blue);
  font-weight: 700;
}
.sld-persona-decline {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-top: 3px;
  padding-top: 7px;
  border-top: 1px dashed var(--ezk-line);
  gap: 10px;
}
.sld-persona-decline-k {
  flex-shrink: 0;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 8.5px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.sld-persona-decline-v {
  font-size: 10.5px; line-height: 1.4;
  color: var(--ezk-ink-2);
  font-weight: 600;
  text-align: right;
}

.sld-persona-path {
  list-style: none; padding: 0; margin: 0 0 12px;
  display: flex; flex-direction: column;
  flex: 1;
}
.sld-persona-path li {
  position: relative;
  padding: 8px 0 8px 22px;
  border-left: 2px dashed rgba(96, 165, 250, 0.40);
  margin-left: 5px;
}
.sld-persona-path li:last-child {
  border-left-color: transparent;
}
.sld-persona-path-dot {
  position: absolute;
  left: -6px; top: 11px;
  width: 9px; height: 9px;
  border-radius: 999px;
  background: var(--ezk-blue);
  box-shadow: 0 0 0 3px #fff, 0 0 0 4px rgba(59, 130, 246, 0.25);
}
.sld-persona-path li.is-terminal .sld-persona-path-dot {
  background: #A78BFA;
  box-shadow: 0 0 0 3px #fff, 0 0 0 4px rgba(167, 139, 250, 0.35);
}
.sld-persona-path-h {
  display: block;
  font-size: 12px; font-weight: 600;
  color: var(--ezk-ink);
  margin-bottom: 1px;
}
.sld-persona-path-b {
  display: block;
  font-size: 10.5px; line-height: 1.4;
  color: var(--ezk-mute);
}
.sld-persona-outcome {
  margin-top: auto;
  padding: 10px 12px;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  border-radius: 9px;
  color: #fff;
  display: flex; flex-direction: column; gap: 2px;
}
.sld-persona-c .sld-persona-outcome {
  background: linear-gradient(135deg, #5B21B6 0%, #6D28D9 100%);
}
.sld-persona-outcome-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 9px; letter-spacing: 0.20em; font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
}
.sld-persona-outcome-v {
  font-size: 11.5px; line-height: 1.4;
}

@media (max-width: 980px) {
  .sld-signals-grid { grid-template-columns: 1fr; }
  .sld-tier-stack-wrap { grid-template-columns: 1fr; }
  .sld-patterns-grid { grid-template-columns: 1fr; }
  .sld-personas-grid { grid-template-columns: 1fr; }
  .sld-form-deep { width: 100%; max-width: 420px; }
}

/* ========================== DARK SLIDE TREATMENT ========================= */
/* When a deep-dive slide is flagged "dark: true", the whole slide chrome
 * flips to the navy backdrop the landing-page deep-dive sections use.
 * Card surfaces inside also swap to dark-glass variants so the slide
 * reads as a continuation of the landing-page quality bar. */

.sld-slide-dark {
  background:
    radial-gradient(ellipse 60% 50% at 15% 10%, rgba(96, 165, 250, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 90%, rgba(59, 130, 246, 0.16) 0%, transparent 55%),
    linear-gradient(180deg, #0F172A 0%, #0A0F1F 100%);
  color: #EEF2F8;
}
.sld-slide-dark .sld-eyebrow {
  background: rgba(96, 165, 250, 0.14);
  border-color: rgba(96, 165, 250, 0.34);
  color: var(--ezk-blue-2);
}
.sld-slide-dark .sld-h2 { color: #fff; }
.sld-slide-dark .sld-h2 em { color: rgba(238, 242, 248, 0.74); }
.sld-slide-dark .grad-blue {
  background: linear-gradient(120deg, var(--ezk-blue-2) 0%, #93C5FD 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-slide-dark .grad-blue-deep {
  background: linear-gradient(120deg, #C7D2FE 0%, #fff 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-slide-dark .sld-sub { color: rgba(238, 242, 248, 0.74); }
.sld-slide-dark .sld-sub strong { color: var(--ezk-blue-2); }
.sld-slide-dark .sld-slide-n { color: rgba(238, 242, 248, 0.45); }

/* SIGNAL CARDS · DARK */
.sld-slide-dark .sld-signal {
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.16), transparent 65%),
    linear-gradient(180deg, rgba(30, 40, 64, 0.55) 0%, rgba(16, 22, 36, 0.55) 100%);
  border: 1px solid rgba(96, 165, 250, 0.24);
  backdrop-filter: blur(14px);
  box-shadow:
    0 22px 50px -28px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.sld-slide-dark .sld-signal:hover {
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow:
    0 36px 70px -28px rgba(96, 165, 250, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.sld-slide-dark .sld-signal-h { color: #fff; }
.sld-slide-dark .sld-signal-b { color: rgba(238, 242, 248, 0.74); }
.sld-slide-dark .sld-signal-list li { color: rgba(238, 242, 248, 0.78); }
.sld-slide-dark .sld-signal-tag {
  background: rgba(96, 165, 250, 0.14);
  color: var(--ezk-blue-2);
  border-color: rgba(96, 165, 250, 0.28);
}
.sld-slide-dark .sld-signal-foot {
  border-top-color: rgba(96, 165, 250, 0.20);
}
.sld-slide-dark .sld-signal-foot-k { color: rgba(238, 242, 248, 0.55); }
.sld-slide-dark .sld-signal-foot-v { color: var(--ezk-blue-2); }
.sld-slide-dark .sld-signal-metric {
  background: linear-gradient(135deg, #fff 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* TIER STACK PANEL · DARK slide */
.sld-slide-dark .sld-tier-stack-wrap {
  border: 1px solid rgba(96, 165, 250, 0.34);
  box-shadow:
    0 36px 70px -28px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}

/* PATTERN CARDS · DARK slide */
.sld-slide-dark .sld-pattern {
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.14), transparent 65%),
    linear-gradient(180deg, rgba(30, 40, 64, 0.55) 0%, rgba(16, 22, 36, 0.55) 100%);
  border: 1px solid rgba(96, 165, 250, 0.24);
  backdrop-filter: blur(14px);
  box-shadow:
    0 22px 50px -28px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.sld-slide-dark .sld-pattern:hover {
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow:
    0 36px 70px -28px rgba(96, 165, 250, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.sld-slide-dark .sld-pattern-h { color: #fff; }
.sld-slide-dark .sld-pattern-b { color: rgba(238, 242, 248, 0.74); }
.sld-slide-dark .sld-pattern-tag { color: var(--ezk-blue-2); }
.sld-slide-dark .sld-pattern-hops {
  background: rgba(96, 165, 250, 0.06);
  border: 1px solid rgba(96, 165, 250, 0.18);
}
.sld-slide-dark .sld-pattern-hop-h { color: #fff; }
.sld-slide-dark .sld-pattern-hop-b { color: rgba(238, 242, 248, 0.62); }
.sld-slide-dark .sld-pattern-hop-n {
  background: rgba(96, 165, 250, 0.18);
  color: var(--ezk-blue-2);
}
.sld-slide-dark .sld-pattern-outcome {
  border: 1px solid rgba(96, 165, 250, 0.40);
  box-shadow: 0 18px 40px -16px rgba(59, 130, 246, 0.55);
}

/* PERSONA CARDS · DARK slide */
.sld-slide-dark .sld-persona {
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.14), transparent 65%),
    linear-gradient(180deg, rgba(30, 40, 64, 0.55) 0%, rgba(16, 22, 36, 0.55) 100%);
  border: 1px solid rgba(96, 165, 250, 0.24);
  backdrop-filter: blur(14px);
  box-shadow:
    0 22px 50px -28px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.sld-slide-dark .sld-persona:hover {
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow:
    0 36px 70px -28px rgba(96, 165, 250, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.sld-slide-dark .sld-persona-head {
  border-bottom: 1px solid rgba(96, 165, 250, 0.18);
}
.sld-slide-dark .sld-persona-name { color: #fff; }
.sld-slide-dark .sld-persona-source { color: rgba(238, 242, 248, 0.55); }
.sld-slide-dark .sld-persona-stats {
  background: rgba(96, 165, 250, 0.06);
  border: 1px solid rgba(96, 165, 250, 0.16);
}
.sld-slide-dark .sld-persona-stat-k { color: rgba(238, 242, 248, 0.55); }
.sld-slide-dark .sld-persona-stat-v { color: #fff; }
.sld-slide-dark .sld-persona-signals {
  background: rgba(96, 165, 250, 0.18);
  border-color: rgba(96, 165, 250, 0.20);
}
.sld-slide-dark .sld-persona-signal {
  background: rgba(15, 23, 42, 0.55);
}
.sld-slide-dark .sld-persona-signal-k { color: rgba(238, 242, 248, 0.55); }
.sld-slide-dark .sld-persona-signal-v {
  background: linear-gradient(135deg, #fff 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sld-slide-dark .sld-persona-funding {
  background: rgba(96, 165, 250, 0.06);
  border: 1px solid rgba(96, 165, 250, 0.20);
}
.sld-slide-dark .sld-persona-funding-label { color: #fff; }
.sld-slide-dark .sld-persona-funding-amt { color: #fff; }
.sld-slide-dark .sld-persona-funding-check.is-approved {
  background: rgba(96, 165, 250, 0.28);
}
.sld-slide-dark .sld-persona-funding-check.is-declined {
  background: rgba(167, 139, 250, 0.28);
  color: #C7D2FE;
}
.sld-slide-dark .sld-persona-funding-flag.is-approved {
  background: rgba(96, 165, 250, 0.22);
  border-color: rgba(96, 165, 250, 0.40);
  color: var(--ezk-blue-2);
}
.sld-slide-dark .sld-persona-funding-flag.is-declined {
  background: rgba(167, 139, 250, 0.22);
  border-color: rgba(167, 139, 250, 0.40);
  color: #C7D2FE;
}
.sld-slide-dark .sld-persona-bmpo {
  background: rgba(96, 165, 250, 0.10);
  border-left-color: rgba(96, 165, 250, 0.55);
}
.sld-slide-dark .sld-persona-bmpo-k { color: rgba(238, 242, 248, 0.55); }
.sld-slide-dark .sld-persona-bmpo-v { color: var(--ezk-blue-2); }
.sld-slide-dark .sld-persona-decline {
  border-top: 1px dashed rgba(96, 165, 250, 0.20);
}
.sld-slide-dark .sld-persona-decline-k { color: rgba(238, 242, 248, 0.55); }
.sld-slide-dark .sld-persona-decline-v { color: rgba(238, 242, 248, 0.85); }
.sld-slide-dark .sld-persona-path li {
  border-left-color: rgba(96, 165, 250, 0.35);
}
.sld-slide-dark .sld-persona-path-h { color: #fff; }
.sld-slide-dark .sld-persona-path-b { color: rgba(238, 242, 248, 0.55); }
.sld-slide-dark .sld-persona-path-dot {
  box-shadow: 0 0 0 3px #0F172A, 0 0 0 4px rgba(96, 165, 250, 0.45);
}
.sld-slide-dark .sld-persona-path li.is-terminal .sld-persona-path-dot {
  box-shadow: 0 0 0 3px #0F172A, 0 0 0 4px rgba(167, 139, 250, 0.55);
}
.sld-slide-dark .sld-persona-tier-pill {
  background: rgba(96, 165, 250, 0.14);
  border-color: rgba(96, 165, 250, 0.28);
}
.sld-slide-dark .sld-persona-c .sld-persona-tier-pill {
  background: rgba(167, 139, 250, 0.14);
  border-color: rgba(167, 139, 250, 0.34);
  color: var(--ezk-blue-2);
}
.sld-slide-dark .sld-persona-outcome {
  border: 1px solid rgba(96, 165, 250, 0.34);
  box-shadow: 0 18px 40px -16px rgba(59, 130, 246, 0.55);
}
.sld-slide-dark .sld-persona-c .sld-persona-outcome {
  border-color: rgba(167, 139, 250, 0.40);
  box-shadow: 0 18px 40px -16px rgba(139, 92, 246, 0.55);
}
`;
