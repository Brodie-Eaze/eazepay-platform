export async function GET() {
  return new Response(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#16181C" />
<title>TradePay | Volume Plan</title>
<meta name="description" content="TradePay is EazePay's home improvement and home services financing division. This document sets out the program, the growth strategy, and the sales ramp behind the volume commitments." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;500;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root{
    --ink:#16181C; --ember:#C2620E; --ember-l:#E8853A; --tint:#FBEEDF;
    --paper:#F4F4F2; --white:#fff;
    --t1:#1E2227; --t2:#454B52; --t3:#6B7280; --t4:#9CA1A6; --line:rgba(22,24,28,.10); --line2:rgba(22,24,28,.055);
    --d:'Archivo',ui-sans-serif,system-ui,sans-serif;
    --b:'Inter',ui-sans-serif,system-ui,sans-serif;
    --r:14px; --rl:20px;
    --sh:0 1px 2px rgba(22,24,28,.04), 0 8px 24px -8px rgba(22,24,28,.14);
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--b);color:var(--t1);background:var(--paper);line-height:1.65;-webkit-font-smoothing:antialiased}
  h1,h2,h3{margin:0;font-family:var(--d);font-weight:300;letter-spacing:-.03em;line-height:1.08;color:var(--ink)}
  p{margin:0;color:var(--t2)}
  a{color:inherit}
  .wrap{max-width:960px;margin:0 auto;padding-left:30px;padding-right:30px}
  .kicker{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ember)}
  .em{color:var(--ember)}

  .topbar{padding:20px 0;border-bottom:1px solid var(--line);background:#fff}
  .topbar-inner{display:flex;align-items:baseline;gap:10px}
  .wordmark .brand{font-family:var(--d);font-size:19px;font-weight:500;color:var(--ink)}
  .wordmark .sub{font-size:12.5px;color:var(--t3)}

  .hero{padding:56px 0 44px;background:linear-gradient(180deg,#F8F8F6,#F4F4F2)}
  .hero h1{font-size:clamp(32px,4.6vw,46px);margin-top:12px}
  .lede{font-size:16.5px;max-width:620px;margin-top:16px}
  .hero-meta{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--t3);font-weight:600;margin-top:22px}
  .statgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:26px;border:1px solid var(--line);border-radius:var(--rl);overflow:hidden;background:#fff}
  .stat{padding:22px 20px;border-right:1px solid var(--line)}
  .stat:last-child{border-right:0}
  .stat .k{font-family:var(--d);font-size:26px;font-weight:300;color:var(--ink);letter-spacing:-.02em}
  .stat .l{font-size:12.5px;color:var(--t3);margin-top:6px}
  @media(max-width:700px){.statgrid{grid-template-columns:1fr}.stat{border-right:0;border-bottom:1px solid var(--line)}}

  section{padding:44px 0}
  .sec-head{max-width:680px}
  .sec-head h2{font-size:clamp(24px,3vw,32px);margin-top:10px}
  .sec-head p{margin-top:12px;font-size:15.5px}

  .flow{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:26px}
  .flow-step{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:18px}
  .flow-step .n{font-family:var(--d);font-size:12px;font-weight:600;color:var(--ember)}
  .flow-step h3{font-size:15.5px;margin-top:8px}
  .flow-step p{font-size:12.5px;margin-top:8px}
  @media(max-width:900px){.flow{grid-template-columns:1fr 1fr}}
  @media(max-width:560px){.flow{grid-template-columns:1fr}}

  .card{background:#fff;border:1px solid var(--line);border-radius:var(--rl);padding:26px;margin-top:20px}
  .card .tag{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ember);background:var(--tint);padding:4px 10px;border-radius:999px}
  .card h3{font-size:19px;margin-top:12px}
  .card p{font-size:14.5px;margin-top:8px}

  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:760px){.grid-2{grid-template-columns:1fr}}

  .funnel{margin-top:18px;display:flex;flex-direction:column;gap:10px}
  .funnel-row{display:grid;grid-template-columns:1fr 2fr auto;gap:14px;align-items:center}
  .funnel-row .stage{font-size:13.5px;font-weight:600;color:var(--ink)}
  .funnel-row .stage span{display:block;font-size:11.5px;font-weight:400;color:var(--t3);margin-top:2px}
  .funnel-row .bar{height:8px;background:var(--line2);border-radius:99px;overflow:hidden}
  .funnel-row .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--ember),var(--ember-l));border-radius:99px}
  .funnel-row .val{font-family:var(--d);font-size:20px;font-weight:400;color:var(--ink);white-space:nowrap;text-align:right}
  .funnel-row .val span{display:block;font-size:10.5px;font-weight:400;color:var(--t3);font-family:var(--b)}
  @media(max-width:700px){.funnel-row{grid-template-columns:1fr}}

  .callout{background:var(--tint);border-radius:var(--r);padding:16px 18px;margin-top:14px;font-size:13.5px;color:var(--t1)}
  .callout b{color:var(--ink)}

  .tablewrap{overflow-x:auto}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);font-weight:600;padding:9px 12px;border-bottom:1px solid var(--line)}
  td{padding:10px 12px;border-bottom:1px solid var(--line2);color:var(--t1)}
  th.num,td.num{text-align:right;font-variant-numeric:tabular-nums}
  tr.total td{font-weight:600;background:#FAF6F0}
  tr.hl td{background:var(--tint)}
  .table-note{font-size:12.5px;color:var(--t3);margin-top:10px}

  .foot{padding:34px 0;border-top:1px solid var(--line);font-size:12px;color:var(--t3)}
</style>
</head>
<body>

<div class="topbar">
  <div class="wrap topbar-inner">
    <div class="wordmark">
      <span class="brand">TradePay</span>
      <span class="sub"> · A brand of EazePay</span>
    </div>
  </div>
</div>

<div class="hero">
  <div class="wrap">
    <div class="kicker">Lender program overview</div>
    <h1>The TradePay <span class="em">volume plan.</span></h1>
    <p class="lede">TradePay is EazePay's home improvement and home services financing division. This document sets out the program, the growth strategy, and the sales ramp behind the volume commitments.</p>
    <div class="hero-meta">Home improvement and home services vertical &nbsp;|&nbsp; Confidential</div>
    <div class="statgrid">
      <div class="stat"><div class="k">125,000+</div><div class="l">Contractor database, segmented by trade and revenue band</div></div>
      <div class="stat"><div class="k">75 to 85%</div><div class="l">Target waterfall approval rate with live deal support, vs a 45 to 55% single-lender baseline</div></div>
      <div class="stat"><div class="k">$9.7M</div><div class="l">Modeled month 12 volume, all channels combined</div></div>
    </div>
  </div>
</div>

<div class="wrap">

<section id="program">
  <div class="sec-head">
    <div class="kicker">Section 01</div>
    <h2>The program</h2>
    <p>EazePay is a fintech orchestration platform, not a lender. TradePay puts that orchestration to work in the trades: contractors on one side, a full stack of capital partners on the other, and a decision engine in between that matches every applicant to the lender most likely to approve them, in under five seconds. The lending network provides the rails and the capital. TradePay delivers the contractors, the volume, and the servicing that makes the volume fund.</p>
  </div>

  <div class="flow">
    <div class="flow-step"><div class="n">01</div><h3>One application</h3><p>The borrower applies once, at the kitchen table, through a link, QR code, or embedded widget. No re-keying at any later stage.</p></div>
    <div class="flow-step"><div class="n">02</div><h3>Parallel enrichment</h3><p>Three pulls at once: identity and fraud signals, bank-level income and cash flow, and a full credit file enriched with trade lines, utilization, inquiries, employment stability, DTI, and residual income.</p></div>
    <div class="flow-step"><div class="n">03</div><h3>Credit box matching</h3><p>The enriched profile is scored against every lender's box simultaneously: FICO floor and ceiling, income, DTI, geography, ticket size, product type, trade vertical.</p></div>
    <div class="flow-step"><div class="n">04</div><h3>Waterfall cascade</h3><p>The file routes to the lender best positioned to approve and fund it. A decline cascades automatically to the next best fit. No second portal, no second application.</p></div>
    <div class="flow-step"><div class="n">05</div><h3>FDRS works the file</h3><p>A live Finance Department Representative Specialist team works the deals the waterfall does not fund outright: repositioning declines, restructuring the deal, and walking the borrower through stipulations until the file funds. This is where the in-between deals get funded instead of lost.</p></div>
  </div>

  <div class="card">
    <span class="tag">Waterfall mechanics</span>
    <h3>Routing, pulls, and cascade position</h3>
    <p>Fit is determined on enriched prequalification data, so the cascade does not stack hard inquiries on the borrower: a hard credit pull happens at the lender positioned to fund, under that lender's permissible purpose and requirements, not at every rung of the waterfall. Each lender sets its own credit box, position preferences, product set, and volume appetite during rate-card build, receives only files that fit the box it wrote, and sees the file's routing history in the audit trail. Two lenders never see the same file blind: position, pricing, and pull mechanics are agreed per lender before the first application routes.</p>
  </div>

  <div class="grid-2" style="margin-top:14px;">
    <div class="card" style="margin-top:0;">
      <span class="tag">For the contractor</span>
      <h3>An operating platform, not a portal</h3>
      <p>Every contractor gets a full business management platform: dispatching, scheduling, CRM, marketing automation, mobile field app, invoicing, proposals, and reporting, with financing embedded in the daily workflow. Contractors consolidate onto it, so the volume stays.</p>
    </div>
    <div class="card" style="margin-top:0;">
      <span class="tag">For the borrower</span>
      <h3>One application, best real offer</h3>
      <p>Homeowners, employed, average to above-average income, projects tied to real property value. One application returns the best offer they actually qualify for, not the first one that happens to come back.</p>
    </div>
  </div>
</section>

<section id="market">
  <div class="sec-head">
    <div class="kicker">Section 02</div>
    <h2>The market</h2>
    <p>The opportunity is not the market itself. It is what happens to approval and funding rates when orchestration and live deal support replace a single-lender setup, and the service gap contractors report on the incumbent platform.</p>
  </div>

  <div class="grid-2">
    <div class="card" style="margin-top:0;">
      <span class="tag">The approval gap</span>
      <h3>Declines are a routing problem, not a credit problem</h3>
      <p>Most contractors run one primary financing partner. Single-lender programs decline 45 to 55% of applications, and homeowners do not shop a second lender at the kitchen table: they cancel or shrink the project. The program targets total approval rates in the 75 to 85% range, and the lift decomposes mechanically: broader box coverage across prime, near-prime, and specialty, cascade capture of the declines that die today, and stipulation clearance so approved files actually fund. It is a program target, testable from the first week of reporting, and it does not come from approving riskier credit.</p>
    </div>
    <div class="card" style="margin-top:0;">
      <span class="tag">The service gap</span>
      <h3>An installed base without a service layer</h3>
      <p>Contractors we contact describe a consistent pattern on the dominant orchestration platform: slow or no follow-up once files are submitted, no live finance team working the deals, stalled approvals, uncleared stipulations, and declines that never get repositioned. The relationships already exist and are already running financing, just without a service layer behind them. TradePay volume comes from winning those contractors one at a time. Where an incumbent exclusivity clause exists, the motion runs parallel on non-exclusive volume and times the full switch to contract renewal; locked accounts fall out at the conversation stage and are priced into the funnel rates below.</p>
    </div>
  </div>

  <div class="card">
    <span class="tag">Trades in scope</span>
    <h3>Coverage across home improvement and home services</h3>
    <p style="margin-top:8px;"><b>Home improvement:</b> roofing, siding, windows, doors, kitchen and bath, full bath conversions, flooring, sunrooms, decks, fencing, insulation, garages, basement waterproofing, and foundation repair.<br><b>Home services:</b> HVAC, plumbing, electrical panel upgrades, water treatment, pools and spas, home automation and security.</p>
    <p style="margin-top:10px;">The common thread is the sales motion, not the trade: an in-home consultative sale, urgency at the kitchen table, a ticket above credit card comfort, and a rep who needs an approval to close. Launch footprint follows each lender's geographic box, with state licensing variance handled at merchant onboarding.</p>
    <p style="margin-top:10px;"><b>Solar is out of scope for this plan.</b> It is treated as distinct paper, routed only to lenders with explicit solar appetite and its own rate card, and is modeled separately from the volume figures in Section 03 — a $25K–$45K ticket does not belong in the same blended average as the trades below.</p>
  </div>
</section>

<section id="model">
  <div class="sec-head">
    <div class="kicker">Section 03</div>
    <h2>The volume model</h2>
    <p>This is a launch plan, not a trailing record. The funded ramp below counts all three channels: the outbound call center, paid marketing and social, and the app bounty. Marketing and the app bounty are spend-gated and scaled only on observed cost per signed contractor; the outbound engine is the channel controlled end to end.</p>
  </div>

  <div class="card">
    <span class="tag">Step 1: The monthly acquisition funnel, steady state</span>
    <h3>From database to producing contractor</h3>
    <p style="margin-top:10px;">One outbound pod, scaling from 5 to 12 seats across the ramp, works a 125,000+ contractor database, built and extended continuously through ICP-targeted data acquisition, in multi-touch sequences: dials, email, and SMS for opted-in contacts. The dialer runs roughly 300 dials per seat per day, 1,500+ daily dials from the launch pod and 30,000+ per month, which supports 3,000 accounts worked per month; early ramp months run lower while lists, scripts, and onboarding capacity build, which is why the month 1 to 5 signing rows in Step 3 sit below steady state.</p>
    <div class="funnel">
      <div class="funnel-row">
        <div class="stage">Contractor database<span>Segmented by trade and revenue band, extended by ICP-targeted data acquisition</span></div>
        <div class="bar"><i style="width:100%"></i></div>
        <div class="val">125,000+<span>records</span></div>
      </div>
      <div class="funnel-row">
        <div class="stage">Accounts worked per month<span>Multi-touch sequence: 4 dials, 2 emails, 1 opted-in SMS over 14 days</span></div>
        <div class="bar"><i style="width:72%"></i></div>
        <div class="val">3,000<span>per month at steady state</span></div>
      </div>
      <div class="funnel-row">
        <div class="stage">Meaningful conversations<span>9% worked-to-conversation across the full sequence, just under 1% of dials</span></div>
        <div class="bar"><i style="width:44%"></i></div>
        <div class="val">~270<span>per month</span></div>
      </div>
      <div class="funnel-row">
        <div class="stage">Platform demos<span>Roughly half of conversations book and hold a demo</span></div>
        <div class="bar"><i style="width:28%"></i></div>
        <div class="val">~135<span>per month</span></div>
      </div>
      <div class="funnel-row">
        <div class="stage">Signed onboardings<span>55% demo-to-sign: the demo attacks a known pain, declines and unserviced files, and onboarding requires no rip-and-replace of the contractor's workflow</span></div>
        <div class="bar"><i style="width:16%"></i></div>
        <div class="val">~75<span>per month</span></div>
      </div>
      <div class="funnel-row">
        <div class="stage">Producing accounts<span>35% of signed accounts submit and fund within 60 days, driven by the FDRS activation playbook</span></div>
        <div class="bar"><i style="width:8%"></i></div>
        <div class="val">26<span>new producers per month</span></div>
      </div>
    </div>
    <div class="callout"><b>Why the model plans at 35% producing.</b> A meaningful share of signed dealers never submit a file. The model plans against that reality and addresses it with the FDRS activation playbook; every point of activation above 35% is upside. The funnel rates are planning estimates, testable against the engine's sequence dashboards from the first week of Phase 1, and the stress test below shows the effect of being materially wrong.</div>
    <div class="callout"><b>Demand-rich, capacity-gated.</b> At industry-typical decision-maker conversation rates of 1.5 to 2.5% of dials, the same pod generates roughly twice the demo flow this model converts. Signings are deliberately held near 75 per month so every cohort receives the full activation playbook and the 35% producing rate holds. The constraint in this plan is activation quality, not demand.</div>
  </div>

  <div class="card">
    <span class="tag">Step 2: What one producing contractor is worth</span>
    <h3>Per-account production math</h3>
    <div class="tablewrap" style="margin-top:14px;">
    <table>
      <thead><tr><th>Variable</th><th class="num">Planning value</th><th>Basis</th></tr></thead>
      <tbody>
        <tr><td>Funded jobs per producing account per month</td><td class="num">2</td><td>Well-established accounts run 20 to 30 applications per month with 15 or more approvals; blended with occasional users, the average is planned at 2</td></tr>
        <tr><td>Average funded ticket, blended</td><td class="num">$15,000</td><td>Roofing $12K to $18K, windows $15K to $25K, bath $15K to $25K, HVAC $8K to $15K &mdash; solar excluded, modeled separately (Section 02)</td></tr>
        <tr><td>Waterfall approval rate</td><td class="num">75 to 85%</td><td>Program target: box coverage x cascade capture x stipulation clearance, per Section 02</td></tr>
        <tr class="total"><td>Funded volume per producing account per month</td><td class="num">$30,000</td><td>2 funded jobs x $15,000 blended ticket</td></tr>
      </tbody>
    </table>
    </div>
    <p class="table-note">A fully ramped well-established account models at $225K or more per month. The model runs on the $30K blended figure so occasional users are priced in, not ignored.</p>
  </div>

  <div class="card">
    <span class="tag">Step 3: The month-by-month build, year one</span>
    <h3>The month-by-month build, all channels combined</h3>
    <div class="tablewrap" style="margin-top:14px;">
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th class="num">Total signed</th>
          <th class="num">Cumulative signed</th>
          <th class="num">Producing accounts</th>
          <th class="num">Funded volume</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>M1</td><td class="num">15</td><td class="num">15</td><td class="num">0</td><td class="num">Integration month</td></tr>
        <tr><td>M2</td><td class="num">30</td><td class="num">45</td><td class="num">5</td><td class="num">$0.15M</td></tr>
        <tr><td>M3</td><td class="num">50</td><td class="num">95</td><td class="num">16</td><td class="num">$0.5M</td></tr>
        <tr><td>M4</td><td class="num">70</td><td class="num">165</td><td class="num">33</td><td class="num">$1.0M</td></tr>
        <tr><td>M5</td><td class="num">85</td><td class="num">250</td><td class="num">58</td><td class="num">$1.7M</td></tr>
        <tr><td>M6</td><td class="num">100</td><td class="num">350</td><td class="num">88</td><td class="num">$2.6M</td></tr>
        <tr class="hl"><td>M7</td><td class="num">115</td><td class="num">465</td><td class="num">123</td><td class="num">$3.7M</td></tr>
        <tr><td>M8</td><td class="num">115</td><td class="num">580</td><td class="num">163</td><td class="num">$4.9M</td></tr>
        <tr><td>M9</td><td class="num">115</td><td class="num">695</td><td class="num">203</td><td class="num">$6.1M</td></tr>
        <tr><td>M10</td><td class="num">115</td><td class="num">810</td><td class="num">243</td><td class="num">$7.3M</td></tr>
        <tr><td>M11</td><td class="num">115</td><td class="num">925</td><td class="num">284</td><td class="num">$8.5M</td></tr>
        <tr><td>M12</td><td class="num">115</td><td class="num">1,040</td><td class="num">324</td><td class="num">$9.7M</td></tr>
        <tr class="total"><td>Year 2</td><td class="num">115/mo</td><td class="num">2,400+</td><td class="num">330 to 400</td><td class="num">$10M to $12M</td></tr>
        <tr class="total"><td>Year 3</td><td class="num">Sustained</td><td class="num">3,800+</td><td class="num">Saturating</td><td class="num">$12M+</td></tr>
      </tbody>
    </table>
    </div>
    <p class="table-note">Producing accounts in month N equal 35% of cumulative signed accounts as of month N-1, consistent with the day-14 first-funding target in the FDRS activation playbook; the 35% rate itself is measured at 60 days, and within-year-one partial-month ramp and early producer churn are absorbed inside the conservative 35% and $30K blends. Funded volume equals producing accounts x $30K. Year 2 and 3 apply 3% monthly producer attrition and per-producer normalization, which is why the curve flattens toward the stated $10M to $12M+ steady state instead of compounding indefinitely.</p>
    <div class="callout"><b>Stress test.</b> Cut the signing pace by a third and cut activation from 35% to 25%: the plan still runs roughly $3M per month by month 9 and $4.6M by month 12. It withstands being materially wrong on both of its most important inputs at once.</div>

    <div style="margin-top:26px;">
      <span class="tag">Where the signings come from</span>
      <h3>Three channels, running at once</h3>
      <div class="tablewrap" style="margin-top:14px;">
      <table>
        <thead><tr><th>Channel</th><th class="num">M1</th><th class="num">M2</th><th class="num">M3</th><th class="num">M4</th><th class="num">M5</th><th class="num">M6</th><th class="num">Steady</th></tr></thead>
        <tbody>
          <tr><td>Outbound call center</td><td class="num">15</td><td class="num">25</td><td class="num">40</td><td class="num">50</td><td class="num">60</td><td class="num">70</td><td class="num">75</td></tr>
          <tr><td>Marketing and paid social</td><td class="num">0</td><td class="num">5</td><td class="num">10</td><td class="num">15</td><td class="num">20</td><td class="num">25</td><td class="num">30</td></tr>
          <tr><td>App bounty</td><td class="num">0</td><td class="num">0</td><td class="num">0</td><td class="num">5</td><td class="num">5</td><td class="num">5</td><td class="num">10</td></tr>
          <tr class="total"><td>Total signed</td><td class="num">15</td><td class="num">30</td><td class="num">50</td><td class="num">70</td><td class="num">85</td><td class="num">100</td><td class="num">115</td></tr>
        </tbody>
      </table>
      </div>
      <p class="table-note">These are the signings behind the funded ramp above. Paid marketing and social runs at $25K to $30K per month, spend-gated and scaled only on observed cost per signed contractor. The outbound call center alone would run about $6.7M by month 12; marketing and the app bounty lift the combined plan to the funded figures above.</p>
    </div>
  </div>
</section>

</div>

<div class="foot">
  <div class="wrap">© TradePay · A brand of EazePay · Confidential — prepared for lender review</div>
</div>

</body>
</html>
`;
