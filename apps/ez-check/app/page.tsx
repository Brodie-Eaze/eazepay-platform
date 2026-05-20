/**
 * EZ Check · Landing page (root "/" of the standalone ez-check app).
 *
 * Marketing surface for the standalone pre-qualification product. The
 * whole ez-check app is its own deployable — separate Railway service,
 * separate domain. Funnel:
 *
 *   /  →  /sales  →  /checkout  →  /onboarding
 *
 * The public copy here deliberately does NOT name the back-office
 * SaaS systems that the qualified-buyer payload is forwarded to
 * during onboarding — those are internal wiring details that change
 * over time without changing the product story.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EZ_CHECK_COPY, EZ_CHECK_MODULES } from '../lib/ez-check-theme';

/* ----------------------------- copy / config ---------------------------- */

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '#story', label: 'Why EZ Check' },
  { href: '#how', label: 'How it works' },
  { href: '#stack', label: 'The stack' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

const TICKER: Array<{ value: string; label: string; delta: string }> = [
  { value: '<3 sec', label: 'Qualify time', delta: 'soft pull · 0 impact' },
  { value: '+42%', label: 'Calendar show-rate', delta: 'qualified > unqualified' },
  { value: '$3', label: 'Per data pull', delta: 'flat · billed monthly' },
  { value: '1 widget', label: 'Drop-in install', delta: 'iframe · webhook · pixel' },
];

const STATUS_QUO: Array<{ stat: string; label: string }> = [
  { stat: '67%', label: 'Form fillers who never had budget' },
  { stat: '2 hrs', label: 'Closer time wasted per unqualified call' },
  { stat: '$420', label: 'CAC inflation from junk leads (median)' },
  { stat: '11%', label: 'Calendar show-rate on unqualified traffic' },
];

const WITH_EZ_CHECK: Array<{ stat: string; label: string }> = [
  { stat: '0%', label: 'Form fillers reach your closer (filtered upstream)' },
  { stat: 'Same min', label: 'Qualified buyer → calendar booking' },
  { stat: 'Soft pull', label: 'Real fundability signal · zero buyer friction' },
  { stat: '50–80%', label: 'Calendar show-rate · qualified-only traffic' },
];

const PILLARS = [
  {
    n: '01',
    head: 'Smart form',
    metric: '< 3s',
    body: 'Drop a single iframe (or React component) into any funnel. The form reshapes its fields the second a buyer starts answering — high-intent traffic gets the fast path, junky signal gets the verification gauntlet.',
    tags: ['Drop-in iframe', 'React + plain HTML', 'Mobile-first'],
  },
  {
    n: '02',
    head: 'Pre-qualification agents',
    metric: 'FCRA · 0 impact',
    body: 'On submit, ORACLE runs the buyer through soft-pull credit, income capacity, and fundability scoring. Three named agents, transparent thresholds, exportable audit log. Every pull is hashed + timestamped.',
    tags: ['Soft pull', 'Fundability tier', 'Audit log'],
  },
  {
    n: '03',
    head: 'Smart routing',
    metric: 'Same minute',
    body: "Qualified buyers land on the right closer's calendar within seconds. Unqualified buyers see a relevant alternative path. Your CRM gets the structured payload the same minute the form is submitted.",
    tags: ['Calendar routing', 'CRM webhook', 'Tracking pixel'],
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Is this a CRM?',
    a: 'No. EZ Check is a pre-qualification engine that sits in front of your existing CRM. We ship the qualified-buyer payload to whichever CRM you already run — most teams keep using their current sales pipeline tooling and just plug our webhook + pixel in.',
  },
  {
    q: "Does the soft pull affect my buyer's credit?",
    a: "No. Soft pulls are FCRA-compliant and have zero impact on the buyer's score. The buyer sees and consents to the pull at the form-submission step. Audit log of every pull is retained for 7 years and exportable from your admin console.",
  },
  {
    q: "How long until I'm live?",
    a: 'Up to 5 business days. Day 1: workspace + smart-form configuration. Day 2: smart-routing rules + CRM webhook. Day 3: pre-qualification agent thresholds + test traffic. Day 4–5: launch validation with your sales team.',
  },
  {
    q: 'What happens to the unqualified buyers?',
    a: "They never reach your closer's calendar. The smart-routing rules you configure decide what to show them — nurture sequence, alternative product page, exit survey, or just a polite thank-you. Your closer's time is preserved for buyers who can actually transact.",
  },
  {
    q: "Do I have to use this with EazePay's other products (MedPay/TradePay/CoachPay)?",
    a: 'No. EZ Check is a standalone product — vertical-agnostic and not coupled to the EazePay lender marketplace. Use it on any funnel where you want a real fundability signal before your sales team picks up the phone.',
  },
  {
    q: 'How does the $3 per data pull bill?',
    a: 'Metered, in arrears, on the 1st of each month. Every form submission that triggers a qualification data pull is $3. Submissions that bounce before the pull are free. Volume discounts kick in above 5,000/mo — ask your launch engineer.',
  },
];

/* ----------------------------- icons ----------------------------------- */

const Icon = {
  logo: (size = 22) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12l5 5 11-13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  arrow: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  check: (size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5 9-11"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

/* ----------------------------- page ------------------------------------ */

export default function EzCheckLanding(): JSX.Element {
  return (
    <div className="ezl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ezl-mesh" aria-hidden />

      {/* NAV */}
      <header className="ezl-nav">
        <div className="ezl-container ezl-nav-inner">
          <Link href="/" className="ezl-brand" aria-label="EZ Check home">
            <span className="ezl-brand-mark">{Icon.logo()}</span>
            <span className="ezl-brand-word">
              <span className="ezl-brand-l">EZ</span>
              <span className="ezl-brand-slash">/</span>
              <span className="ezl-brand-r">Check</span>
            </span>
          </Link>
          <nav className="ezl-nav-links" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ezl-nav-cta-group">
            <Link href="/sales" className="ezl-nav-link">
              Sales deck
            </Link>
            <Link href="/checkout" className="ezl-btn-primary">
              Activate EZ Check {Icon.arrow()}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="ezl-hero">
          <div className="ezl-container ezl-hero-inner">
            <div className="ezl-hero-l">
              <Reveal>
                <div className="ezl-eyebrow">
                  <span className="ezl-eyebrow-dot" />
                  Pre-qualification engine · for any online business
                </div>
              </Reveal>
              <Reveal delay={120}>
                <h1 className="ezl-h1">
                  <span className="ezl-grad-blue-deep">Fill your calendar</span>
                  <br />
                  <span className="ezl-grad-blue">with buyers,</span>{' '}
                  <span className="ezl-grad-blue-deep">not form fillers.</span>
                </h1>
              </Reveal>
              <Reveal delay={240}>
                <p className="ezl-sub">{EZ_CHECK_COPY.subTagline}</p>
              </Reveal>
              <Reveal delay={360}>
                <div className="ezl-chips">
                  <span className="ezl-chip">Soft-pull FCRA · 0 impact</span>
                  <span className="ezl-chip">Drop-in iframe · React + HTML</span>
                  <span className="ezl-chip">CRM webhook · tracking pixel</span>
                </div>
              </Reveal>
              <Reveal delay={480}>
                <div className="ezl-hero-cta-row">
                  <Link href="/checkout" className="ezl-btn-primary ezl-btn-lg">
                    Activate EZ Check {Icon.arrow()}
                  </Link>
                  <Link href="/sales" className="ezl-btn-ghost ezl-btn-lg">
                    Watch the 12-slide pitch
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={600}>
                <div className="ezl-ticker">
                  {TICKER.map((t, i) => (
                    <div key={i} className="ezl-ticker-item">
                      <div className="ezl-ticker-v">{t.value}</div>
                      <div className="ezl-ticker-k">{t.label}</div>
                      <div className="ezl-ticker-d">{t.delta}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* HERO RIGHT — 3D-tilted "qualified buyer landed" card */}
            <div className="ezl-hero-r">
              <ParticleField count={22} />
              <TiltCard>
                <CalendarLandedMock />
              </TiltCard>
            </div>
          </div>
        </section>

        {/* STORY */}
        <section id="story" className="ezl-section">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                The cost of doing nothing
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">Your closers are paid to close.</span>{' '}
                <span className="ezl-grad-blue">Not to filter form fillers.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                Two thirds of your form submissions have no budget, no intent, or no fundability.
                Right now they hit your closer&apos;s calendar at the same priority as the buyers
                who can actually transact. EZ Check makes that math stop.
              </p>
            </Reveal>

            <Reveal delay={360}>
              <div className="ezl-vs-grid">
                <div className="ezl-vs-side ezl-vs-quo">
                  <div className="ezl-vs-eyebrow">Status quo</div>
                  <div className="ezl-vs-stat-grid">
                    {STATUS_QUO.map((s, i) => (
                      <div key={i} className="ezl-vs-stat">
                        <div className="ezl-vs-stat-v">{s.stat}</div>
                        <div className="ezl-vs-stat-l">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ezl-vs-side ezl-vs-with">
                  <div className="ezl-vs-eyebrow accent">With EZ Check</div>
                  <div className="ezl-vs-stat-grid">
                    {WITH_EZ_CHECK.map((s, i) => (
                      <div key={i} className="ezl-vs-stat ezl-vs-stat-accent">
                        <div className="ezl-vs-stat-v">{s.stat}</div>
                        <div className="ezl-vs-stat-l">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* HOW IT WORKS — 3 stages */}
        <section id="how" className="ezl-section">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                How it works
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">One widget.</span>{' '}
                <span className="ezl-grad-blue">Three agents.</span>{' '}
                <span className="ezl-grad-blue-deep">Qualified buyer on the calendar.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                Each module below maps 1:1 to the onboarding screen — what you configure on day one
                is what runs in production on day six.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-stages">
                {EZ_CHECK_MODULES.map((m, i) => (
                  <article key={m.id} className="ezl-stage">
                    <div className="ezl-stage-glow" aria-hidden />
                    <div className="ezl-stage-n">
                      {m.n} · {m.agent}
                    </div>
                    <h3 className="ezl-stage-h">{m.title}</h3>
                    <p className="ezl-stage-b">{m.body}</p>
                    <ul className="ezl-stage-items">
                      {m.items.map((it, j) => (
                        <li key={j}>
                          <span className="ezl-stage-mark" aria-hidden>
                            {Icon.check(11)}
                          </span>
                          {it}
                        </li>
                      ))}
                    </ul>
                    <div className="ezl-stage-time">⌛ {m.time}</div>
                  </article>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* STACK — 3 pillars */}
        <section id="stack" className="ezl-section">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                The stack
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">Three capabilities.</span>{' '}
                <span className="ezl-grad-blue">One drop-in widget.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                EZ Check is the smart-form, the agents, and the routing — bundled and metered as a
                single product. Install once, run forever.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-pillars">
                {PILLARS.map((p) => (
                  <div key={p.n} className="ezl-pillar">
                    <div className="ezl-pillar-glow" aria-hidden />
                    <div className="ezl-pillar-n">{p.n}</div>
                    <div className="ezl-pillar-metric">{p.metric}</div>
                    <div className="ezl-pillar-h">{p.head}</div>
                    <div className="ezl-pillar-b">{p.body}</div>
                    <div className="ezl-pillar-tags">
                      {p.tags.map((t) => (
                        <span key={t} className="ezl-pillar-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* PRICING TEASER */}
        <section id="pricing" className="ezl-section">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                Pricing
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">$5,000 once.</span>{' '}
                <span className="ezl-grad-blue">$3 per data pull.</span>{' '}
                <span className="ezl-grad-blue-deep">Nothing else.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <p className="ezl-section-sub">
                No monthly platform fee. No minimums. No origination percentage. No contract. You
                can stop the meter any time by disabling the widget — existing pulls still bill that
                month.
              </p>
            </Reveal>
            <Reveal delay={360}>
              <div className="ezl-pricing-row">
                <div className="ezl-pricing-card">
                  <div className="ezl-pricing-tag">SETUP · ONE-TIME</div>
                  <div className="ezl-pricing-v">$5,000</div>
                  <div className="ezl-pricing-b">
                    Workspace, smart-form, smart-routing, agent stack, embed snippet, sales-team
                    training.
                  </div>
                </div>
                <div className="ezl-pricing-card">
                  <div className="ezl-pricing-tag">USAGE · MONTHLY</div>
                  <div className="ezl-pricing-v">$3 / pull</div>
                  <div className="ezl-pricing-b">
                    Billed monthly in arrears. Volume tiers above 5,000/mo.
                  </div>
                </div>
                <div className="ezl-pricing-card ezl-pricing-card-cta">
                  <div className="ezl-pricing-tag accent">START TODAY</div>
                  <div className="ezl-pricing-v">Up to 5 days to live</div>
                  <Link href="/checkout" className="ezl-btn-primary ezl-btn-lg">
                    Activate EZ Check {Icon.arrow()}
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="ezl-section">
          <div className="ezl-container ezl-container-narrow">
            <Reveal>
              <div className="ezl-section-eyebrow">
                <span className="ezl-eyebrow-dot" />
                FAQ
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="ezl-h2">
                <span className="ezl-grad-blue-deep">The questions you&apos;ll ask</span>{' '}
                <span className="ezl-grad-blue">on the demo call.</span>
              </h2>
            </Reveal>
            <Reveal delay={240}>
              <div className="ezl-faq">
                {FAQ.map((f, i) => (
                  <FaqItem key={i} q={f.q} a={f.a} />
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="ezl-section ezl-section-cta">
          <div className="ezl-container">
            <Reveal>
              <div className="ezl-cta-card">
                <div>
                  <div className="ezl-cta-tag">READY TO START</div>
                  <h3 className="ezl-cta-h">
                    Activate EZ Check and ship your first qualified buyer this week.
                  </h3>
                  <p className="ezl-cta-b">
                    Pay the one-time setup fee, complete the three-module onboarding, drop the
                    widget into your funnel. Your launch engineer is in your Slack channel within 1
                    business hour.
                  </p>
                </div>
                <div className="ezl-cta-actions">
                  <Link href="/checkout" className="ezl-btn-primary ezl-btn-xl">
                    Activate now · $5,000 {Icon.arrow()}
                  </Link>
                  <Link href="/sales" className="ezl-btn-ghost ezl-btn-xl">
                    Watch the deck first
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="ezl-footer">
        <div className="ezl-container ezl-footer-inner">
          <div className="ezl-footer-brand">
            {Icon.logo()}
            <span>
              <span className="ezl-brand-l">EZ</span>
              <span className="ezl-brand-slash">/</span>
              <span className="ezl-brand-r">Check</span> · A product of EazePay
            </span>
          </div>
          <div className="ezl-footer-links">
            <Link href="/sales">Sales deck</Link>
            <Link href="/checkout">Pricing</Link>
            <Link href="/onboarding">Onboarding</Link>
            <a href="mailto:launch@eazepay.com?subject=EZ%20Check%20—%20support">Support</a>
          </div>
          <div className="ezl-footer-meta">
            FCRA · ECOA · GLBA · Audit log retained 7 yrs · Buyer consent required on every pull
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============================ components ================================= */

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
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setVisible(true);
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`ezl-reveal ${visible ? 'is-visible' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

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
      card.style.setProperty('--tx', `${-y * 10}deg`);
      card.style.setProperty('--ty', `${x * 14}deg`);
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
    <div className="ezl-tilt-scene" ref={sceneRef}>
      <div className="ezl-tilt-card" ref={cardRef}>
        {children}
      </div>
    </div>
  );
}

function ParticleField({ count = 22 }: { count?: number }): JSX.Element {
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
    <div className="ezl-particles" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.i}
          className="ezl-particle"
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

/** 3D-tilted mock card showing "a qualified buyer just landed on the
 *  closer's calendar" — the visual money-shot for the hero. */
function CalendarLandedMock(): JSX.Element {
  return (
    <div className="ezl-mock">
      <div className="ezl-mock-head">
        <span className="ezl-mock-pill">
          <span className="ezl-mock-pill-dot" /> Qualified · routed
        </span>
        <span className="ezl-mock-meta">Illustrative</span>
      </div>
      <div className="ezl-mock-project">Inbound buyer · pre-qualified</div>
      <div className="ezl-mock-name">
        Jordan M.
        <span className="ezl-mock-name-sub">Tier A · budget verified</span>
      </div>
      <div className="ezl-mock-rows">
        <div>
          <div className="ezl-mock-k">Score</div>
          <div className="ezl-mock-v">724 · soft pull</div>
        </div>
        <div>
          <div className="ezl-mock-k">Income</div>
          <div className="ezl-mock-v">$98k verified</div>
        </div>
        <div>
          <div className="ezl-mock-k">Calendar</div>
          <div className="ezl-mock-v">Sarah · Thu 2:00 PM</div>
        </div>
        <div>
          <div className="ezl-mock-k">Source</div>
          <div className="ezl-mock-v">meta_advantage</div>
        </div>
      </div>
      <div className="ezl-mock-bar">
        <div className="ezl-mock-bar-fill" />
      </div>
      <div className="ezl-mock-stages">
        <span className="on">Form</span>
        <span className="on">Soft pull</span>
        <span className="on">Score</span>
        <span className="cur">Calendar</span>
        <span>Closer</span>
      </div>
      <div className="ezl-mock-cta">Routed to calendar →</div>
      <div className="ezl-mock-foot">FCRA soft pull · 0 impact · audit log retained 7 yrs</div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ezl-faq-item ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="ezl-faq-q"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <span className="ezl-faq-chev" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <div className="ezl-faq-a">{a}</div> : null}
    </div>
  );
}

/* ================================= CSS =================================== */

const CSS = `
.ezl-root {
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
.ezl-root * { box-sizing: border-box; }
.ezl-root a { color: inherit; text-decoration: none; }
.ezl-root button { font-family: inherit; cursor: pointer; }

.ezl-mesh {
  position: fixed; inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 40% at 15% 20%, rgba(96, 165, 250, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 85% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 90%, rgba(96, 165, 250, 0.10) 0%, transparent 55%);
  animation: ezlMeshDrift 24s ease-in-out infinite;
}
@keyframes ezlMeshDrift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-30px, 20px) scale(1.05); }
  66% { transform: translate(20px, -10px) scale(0.98); }
}

.ezl-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }
.ezl-container-narrow { max-width: 820px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }

.ezl-grad-blue { background: linear-gradient(120deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.ezl-grad-blue-deep { background: linear-gradient(120deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }

/* NAV */
.ezl-nav {
  position: sticky; top: 0; z-index: 40;
  background: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid var(--ezk-line);
  backdrop-filter: blur(10px);
}
.ezl-nav-inner {
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.ezl-brand {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--ezk-blue);
}
.ezl-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  box-shadow: 0 8px 24px -8px rgba(59, 130, 246, 0.45);
}
.ezl-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; color: var(--ezk-ink); }
.ezl-brand-l { color: var(--ezk-blue); }
.ezl-brand-slash { color: var(--ezk-mute); margin: 0 1px; font-weight: 400; }
.ezl-brand-r { color: var(--ezk-ink); }
.ezl-nav-links {
  display: inline-flex; gap: 22px;
  margin-left: 16px;
  font-size: 13.5px; color: var(--ezk-ink-2);
}
.ezl-nav-links a:hover { color: var(--ezk-blue); }
.ezl-nav-cta-group { margin-left: auto; display: inline-flex; align-items: center; gap: 14px; }
.ezl-nav-link { font-size: 13.5px; color: var(--ezk-ink-2); }
.ezl-nav-link:hover { color: var(--ezk-blue); }

/* BUTTONS */
.ezl-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  font-size: 13.5px; font-weight: 600;
  border-radius: 999px;
  border: 0;
  box-shadow: 0 12px 24px -8px rgba(59, 130, 246, 0.45);
  transition: transform .15s ease, box-shadow .15s ease;
}
.ezl-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px -8px rgba(59, 130, 246, 0.55);
}
.ezl-btn-lg { padding: 13px 26px; font-size: 14.5px; }
.ezl-btn-xl { padding: 16px 30px; font-size: 16px; }
.ezl-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--ezk-line-strong);
  color: var(--ezk-ink);
  font-size: 13.5px; font-weight: 600;
  border-radius: 999px;
  transition: all .15s ease;
}
.ezl-btn-ghost:hover {
  background: #fff;
  border-color: var(--ezk-blue);
  color: var(--ezk-blue);
}

/* REVEAL */
.ezl-reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1),
              transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.ezl-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* EYEBROW */
.ezl-eyebrow, .ezl-section-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  padding: 6px 14px;
  background: rgba(59, 130, 246, 0.10);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.ezl-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--ezk-blue-2);
  box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.5);
  animation: ezlPulse 1.6s ease-in-out infinite;
}
@keyframes ezlPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(96, 165, 250, 0); }
}

/* HERO */
.ezl-hero {
  position: relative;
  padding: 80px 0 56px;
}
.ezl-hero-inner {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 56px;
  align-items: center;
}
.ezl-hero-l { display: flex; flex-direction: column; gap: 24px; align-items: flex-start; }
.ezl-hero-r {
  position: relative;
  min-height: 480px;
  display: flex; align-items: center; justify-content: center;
}
.ezl-h1 {
  font-size: clamp(48px, 6vw, 80px);
  font-weight: 600;
  letter-spacing: -0.04em; line-height: 1.02;
  margin: 0;
  color: var(--ezk-ink);
}
.ezl-sub {
  font-size: 19px; line-height: 1.55;
  color: var(--ezk-ink-2);
  max-width: 620px;
  margin: 0;
}
.ezl-chips {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 4px;
}
.ezl-chip {
  display: inline-flex; align-items: center;
  font-size: 12px; letter-spacing: 0.04em;
  color: var(--ezk-ink-2);
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--ezk-line);
  border-radius: 999px;
}
.ezl-hero-cta-row {
  display: flex; gap: 12px; flex-wrap: wrap;
  margin-top: 4px;
}
.ezl-ticker {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin-top: 16px;
  padding: 20px 0;
  border-top: 1px solid var(--ezk-line);
  width: 100%;
}
.ezl-ticker-item {
  padding-right: 16px;
  border-right: 1px solid var(--ezk-line);
}
.ezl-ticker-item:last-child { border-right: 0; }
.ezl-ticker-v {
  font-size: 24px; font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--ezk-ink);
  font-variant-numeric: tabular-nums;
}
.ezl-ticker-k {
  margin-top: 2px;
  font-size: 11px; letter-spacing: 0.14em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.ezl-ticker-d {
  margin-top: 6px;
  font-size: 11.5px; color: var(--ezk-blue);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}

/* PARTICLES */
.ezl-particles {
  position: absolute; inset: 0;
  pointer-events: none;
  z-index: 0;
}
.ezl-particle {
  position: absolute;
  border-radius: 999px;
  background: var(--ezk-blue-2);
  box-shadow: 0 0 6px rgba(96, 165, 250, 0.5);
  animation: ezlFloat 12s ease-in-out infinite;
  opacity: 0.4;
}
@keyframes ezlFloat {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 0.55; }
  50% { transform: translateY(-40px) translateX(20px); opacity: 0.4; }
  90% { opacity: 0.4; }
  100% { transform: translateY(-80px) translateX(-10px); opacity: 0; }
}

/* TILT */
.ezl-tilt-scene {
  perspective: 1400px;
  perspective-origin: 50% 50%;
  width: 100%;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  z-index: 2;
}
.ezl-tilt-card {
  --tx: 6deg;
  --ty: -10deg;
  transform-style: preserve-3d;
  transform: rotateX(var(--tx)) rotateY(var(--ty));
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

/* MOCK CARD */
.ezl-mock {
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
.ezl-mock-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ezk-line);
}
.ezl-mock-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  text-transform: uppercase;
  padding: 4px 10px;
  background: rgba(96, 165, 250, 0.14);
  border-radius: 999px;
}
.ezl-mock-pill-dot { width: 5px; height: 5px; border-radius: 999px; background: var(--ezk-blue-2); }
.ezl-mock-meta {
  font-size: 9px; letter-spacing: 0.18em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
}
.ezl-mock-project {
  margin-top: 14px;
  font-size: 10.5px; letter-spacing: 0.22em;
  color: var(--ezk-mute);
  text-transform: uppercase;
}
.ezl-mock-name {
  margin-top: 4px;
  font-size: 38px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ezk-ink);
  display: flex; align-items: baseline; gap: 12px;
  flex-wrap: wrap;
}
.ezl-mock-name-sub {
  font-size: 12px; font-weight: 600;
  color: var(--ezk-blue);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.ezl-mock-rows {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--ezk-line);
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.ezl-mock-k {
  font-size: 9px; letter-spacing: 0.20em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.ezl-mock-v {
  margin-top: 4px;
  font-size: 14px; font-weight: 600;
  color: var(--ezk-ink);
}
.ezl-mock-bar {
  margin-top: 18px;
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.ezl-mock-bar-fill {
  height: 100%;
  width: 80%;
  background: linear-gradient(90deg, var(--ezk-blue-deep) 0%, var(--ezk-blue-2) 100%);
  border-radius: 999px;
  animation: ezlBarFill 1.8s ease-out;
}
@keyframes ezlBarFill {
  from { width: 0%; }
  to { width: 80%; }
}
.ezl-mock-stages {
  margin-top: 10px;
  display: flex; justify-content: space-between;
  font-size: 9px; letter-spacing: 0.10em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  font-weight: 600;
}
.ezl-mock-stages .on { color: var(--ezk-blue); }
.ezl-mock-stages .cur {
  color: var(--ezk-blue-deep);
  position: relative;
}
.ezl-mock-stages .cur::after {
  content: '';
  position: absolute; bottom: -4px; left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 999px;
  background: var(--ezk-blue-2);
}
.ezl-mock-cta {
  margin-top: 18px;
  padding: 13px 16px;
  text-align: center;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  color: #fff;
  border-radius: 12px;
  font-size: 13.5px; font-weight: 700;
  letter-spacing: 0.02em;
}
.ezl-mock-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--ezk-line);
  font-size: 10px; letter-spacing: 0.14em;
  color: var(--ezk-mute);
  text-transform: uppercase;
  text-align: center;
}

/* SECTIONS */
.ezl-section {
  position: relative;
  padding: 80px 0;
}
.ezl-section-eyebrow { margin-bottom: 18px; }
.ezl-h2 {
  font-size: clamp(34px, 4.4vw, 56px);
  font-weight: 600;
  letter-spacing: -0.034em; line-height: 1.08;
  margin: 0 0 14px;
  color: var(--ezk-ink);
}
.ezl-section-sub {
  font-size: 17px; line-height: 1.6;
  color: var(--ezk-ink-2);
  max-width: 760px;
  margin: 0 0 36px;
}

/* VS GRID */
.ezl-vs-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.ezl-vs-side {
  padding: 28px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--ezk-line);
}
.ezl-vs-with {
  background:
    radial-gradient(ellipse 80% 100% at 100% 0%, rgba(96, 165, 250, 0.18), transparent 70%),
    rgba(255, 255, 255, 0.96);
  border-color: var(--ezk-line-strong);
  box-shadow: 0 22px 50px -28px rgba(59, 130, 246, 0.30);
}
.ezl-vs-eyebrow {
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--ezk-mute);
  text-transform: uppercase;
  margin-bottom: 18px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}
.ezl-vs-eyebrow.accent { color: var(--ezk-blue); }
.ezl-vs-stat-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.ezl-vs-stat {}
.ezl-vs-stat-v {
  font-size: 38px; font-weight: 800; letter-spacing: -0.03em;
  color: var(--ezk-ink);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.ezl-vs-stat-accent .ezl-vs-stat-v {
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ezl-vs-stat-l {
  margin-top: 6px;
  font-size: 12.5px; color: var(--ezk-mute);
  line-height: 1.5;
}

/* STAGES */
.ezl-stages {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  perspective: 1400px;
}
.ezl-stage {
  position: relative;
  padding: 26px;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.12), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.98) 100%);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 22px;
  box-shadow: 0 22px 60px -32px rgba(59, 130, 246, 0.28);
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: hidden;
}
.ezl-stage:hover {
  transform: translateY(-6px) rotateX(2deg);
  box-shadow: 0 36px 80px -32px rgba(59, 130, 246, 0.40);
}
.ezl-stage-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 110%, rgba(96, 165, 250, 0.18), transparent 60%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.ezl-stage:hover .ezl-stage-glow { opacity: 1; }
.ezl-stage > * { position: relative; z-index: 1; }
.ezl-stage-n {
  display: inline-block;
  padding: 3px 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
}
.ezl-stage-h {
  margin: 14px 0 6px;
  font-size: 22px; font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ezk-ink);
}
.ezl-stage-b {
  margin: 0 0 14px;
  font-size: 13.5px; line-height: 1.55;
  color: var(--ezk-ink-2);
}
.ezl-stage-items {
  list-style: none; padding: 0; margin: 0 0 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.ezl-stage-items li {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--ezk-ink-2);
}
.ezl-stage-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--ezk-blue) 0%, var(--ezk-blue-2) 100%);
  color: #fff;
  flex-shrink: 0;
}
.ezl-stage-time {
  display: inline-block;
  padding: 4px 10px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; color: var(--ezk-mute);
  background: rgba(15, 23, 42, 0.04);
  border-radius: 999px;
}

/* PILLARS — same shape as MedPay sales deck, sky-blue */
.ezl-pillars {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  perspective: 1400px;
}
.ezl-pillar {
  position: relative;
  background:
    radial-gradient(ellipse 80% 60% at 0% 0%, rgba(96, 165, 250, 0.10), transparent 65%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 251, 255, 0.97) 100%);
  border: 1px solid var(--ezk-line-strong);
  border-radius: 22px;
  padding: 26px;
  box-shadow:
    0 22px 60px -32px rgba(59, 130, 246, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform .35s cubic-bezier(0.22, 0.61, 0.36, 1),
              box-shadow .35s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow: hidden;
}
.ezl-pillar:hover {
  transform: translateY(-6px) rotateX(2deg);
  box-shadow:
    0 36px 80px -32px rgba(59, 130, 246, 0.40),
    inset 0 1px 0 rgba(255, 255, 255, 1);
}
.ezl-pillar-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 110%, rgba(96, 165, 250, 0.20), transparent 60%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.ezl-pillar:hover .ezl-pillar-glow { opacity: 1; }
.ezl-pillar > * { position: relative; z-index: 1; }
.ezl-pillar-n {
  display: inline-block;
  padding: 3px 8px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10px; letter-spacing: 0.20em; font-weight: 700;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.20);
  border-radius: 6px;
}
.ezl-pillar-metric {
  margin-top: 12px;
  font-size: 40px; font-weight: 700;
  letter-spacing: -0.038em;
  line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.ezl-pillar-h {
  margin-top: 10px;
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--ezk-ink);
}
.ezl-pillar-b {
  margin-top: 6px;
  font-size: 13.5px; color: var(--ezk-ink-2); line-height: 1.55;
}
.ezl-pillar-tags {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--ezk-line);
  display: flex; flex-wrap: wrap;
  gap: 6px;
}
.ezl-pillar-tag {
  font-size: 10.5px; letter-spacing: 0.04em;
  font-weight: 600;
  color: var(--ezk-blue);
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.16);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
}

/* PRICING ROW */
.ezl-pricing-row {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.ezl-pricing-card {
  padding: 28px;
  background: #fff;
  border: 1px solid var(--ezk-line);
  border-radius: 22px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 18px 50px -28px rgba(59, 130, 246, 0.22);
}
.ezl-pricing-card-cta {
  background:
    radial-gradient(ellipse 70% 100% at 0% 0%, rgba(96, 165, 250, 0.20), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  color: #fff;
  border-color: rgba(96, 165, 250, 0.34);
}
.ezl-pricing-card-cta .ezl-pricing-tag {
  color: var(--ezk-blue-2);
}
.ezl-pricing-card-cta .ezl-pricing-v {
  background: linear-gradient(135deg, #fff 0%, var(--ezk-blue-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-size: 28px;
}
.ezl-pricing-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue); text-transform: uppercase;
}
.ezl-pricing-tag.accent { color: var(--ezk-blue-2); }
.ezl-pricing-v {
  font-size: 42px; font-weight: 700;
  letter-spacing: -0.035em; line-height: 1;
  background: linear-gradient(135deg, var(--ezk-blue-deep) 0%, var(--ezk-blue) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  font-variant-numeric: tabular-nums;
}
.ezl-pricing-b {
  font-size: 13.5px; line-height: 1.5; color: var(--ezk-ink-2);
  margin-top: auto;
}
.ezl-pricing-card-cta .ezl-pricing-b { color: rgba(255, 255, 255, 0.75); }

/* FAQ */
.ezl-faq {
  display: flex; flex-direction: column; gap: 8px;
  margin-top: 8px;
}
.ezl-faq-item {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--ezk-line);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color .15s ease;
}
.ezl-faq-item.is-open { border-color: var(--ezk-line-strong); }
.ezl-faq-q {
  width: 100%;
  padding: 18px 22px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 16px; font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ezk-ink);
  text-align: left;
}
.ezl-faq-chev {
  font-size: 22px; font-weight: 400;
  color: var(--ezk-blue);
  line-height: 1;
}
.ezl-faq-a {
  padding: 0 22px 18px;
  font-size: 14px; line-height: 1.6;
  color: var(--ezk-ink-2);
}

/* FINAL CTA */
.ezl-section-cta { padding: 80px 0 100px; }
.ezl-cta-card {
  padding: 48px;
  background:
    radial-gradient(ellipse 60% 100% at 0% 0%, rgba(96, 165, 250, 0.20), transparent 65%),
    linear-gradient(135deg, var(--ezk-blue-deep) 0%, #1E40AF 100%);
  border-radius: 28px;
  color: #fff;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 32px;
  align-items: center;
  box-shadow:
    0 40px 80px -40px rgba(59, 130, 246, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
}
.ezl-cta-tag {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--ezk-blue-2);
  text-transform: uppercase;
  margin-bottom: 12px;
}
.ezl-cta-h {
  margin: 0 0 14px;
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 600;
  letter-spacing: -0.022em;
  line-height: 1.15;
  color: #fff;
}
.ezl-cta-b {
  margin: 0;
  font-size: 14.5px; line-height: 1.6;
  color: rgba(255, 255, 255, 0.78);
  max-width: 480px;
}
.ezl-cta-actions {
  display: flex; flex-direction: column; gap: 10px;
  align-items: stretch;
}
.ezl-cta-actions .ezl-btn-ghost {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: #fff;
  justify-content: center;
}
.ezl-cta-actions .ezl-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}
.ezl-cta-actions .ezl-btn-primary { justify-content: center; }

/* FOOTER */
.ezl-footer {
  position: relative; z-index: 1;
  padding: 36px 0;
  border-top: 1px solid var(--ezk-line);
  background: rgba(255, 255, 255, 0.7);
}
.ezl-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.ezl-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--ezk-ink-2);
  font-weight: 500;
}
.ezl-footer-links {
  display: inline-flex; gap: 22px;
  font-size: 13px; color: var(--ezk-ink-2);
}
.ezl-footer-links a:hover { color: var(--ezk-blue); }
.ezl-footer-meta {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.08em;
  color: var(--ezk-mute);
  text-align: right;
  flex-basis: 100%;
}

/* RESPONSIVE */
@media (max-width: 980px) {
  .ezl-hero-inner { grid-template-columns: 1fr; gap: 36px; }
  .ezl-hero-r { min-height: 360px; }
  .ezl-mock { width: 100%; max-width: 440px; }
  .ezl-ticker { grid-template-columns: 1fr 1fr; }
  .ezl-ticker-item:nth-child(2) { border-right: 0; }
  .ezl-vs-grid { grid-template-columns: 1fr; }
  .ezl-vs-stat-grid { grid-template-columns: 1fr 1fr; }
  .ezl-stages { grid-template-columns: 1fr; }
  .ezl-pillars { grid-template-columns: 1fr; }
  .ezl-pricing-row { grid-template-columns: 1fr; }
  .ezl-cta-card { grid-template-columns: 1fr; padding: 32px; }
  .ezl-nav-links { display: none; }
  .ezl-footer-inner { flex-direction: column; align-items: flex-start; }
  .ezl-footer-meta { text-align: left; }
}
`;
