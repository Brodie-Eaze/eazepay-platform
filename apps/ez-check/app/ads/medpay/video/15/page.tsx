/**
 * Video ad V11 v6 · 27s · 1080x1920
 *
 * Old-funnel vs MedPay-funnel contrast for practice owners. The MedPay
 * section uses a proper SVG multi-hop routing tree (same topology as the
 * landing-page gold standard): root, one budget gate, two parallel hops,
 * four terminal-feeders, six terminals. A glowing orb traces one buyer's
 * path through the tree and lights up each node it passes.
 *
 *    0.0 to 3.0   HOOK    Practice owner. There are two ways to run your clinic.
 *    3.0 to 4.0   TAG     Here is how most do it today.
 *    4.0 to 10.0  TODAY   Lead. Closer dials all. Hours on unqualified buyers.
 *   10.0 to 11.0  PIVOT   Now here is MedPay.
 *   11.0 to 20.0  MEDPAY  SVG tree, orb traces one buyer's path through the hops.
 *   20.0 to 22.0  RESULT  Qualified buyers. Booked calls. Funded same day.
 *   22.0 to 24.0  STAMP   That is MedPay.
 *   24.0 to 27.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV15(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        @keyframes vs-fade-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes v15-pop-in {
          0% {
            opacity: 0;
            transform: scale(0.94) translateY(18px);
          }
          60% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes v15-blur-in {
          0% {
            opacity: 0;
            filter: blur(20px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
          }
        }

        /* ─── ACT 1 hook (0 to 3s) ─────────────────────────────────────── */
        .v15-a1 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 0.2s forwards,
            vs-fade-out 0.5s 3s forwards;
        }
        .v15-a1-pre {
          position: absolute;
          top: 600px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 38px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation: v15-blur-in 0.5s 0.4s forwards;
        }
        .v15-a1-h {
          position: absolute;
          top: 680px;
          left: 40px;
          right: 40px;
          text-align: center;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.02;
          color: #fff;
          text-shadow: 0 0 80px rgba(34, 184, 160, 0.4);
          opacity: 0;
          animation: v15-blur-in 0.6s 0.9s forwards;
        }
        .v15-a1-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v15-a1-sub {
          position: absolute;
          top: 1080px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 32px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.4;
          padding: 0 80px;
          opacity: 0;
          animation: vs-in-up 0.5s 1.8s forwards;
        }

        /* ─── ACT 2 tag (3 to 4s) ──────────────────────────────────────── */
        .v15-a2 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 3.1s forwards,
            vs-fade-out 0.3s 4s forwards;
        }
        .v15-a2-h {
          position: absolute;
          top: 800px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #fff;
        }
        .v15-a2-h em {
          font-style: normal;
          color: rgba(248, 113, 113, 0.9);
        }

        /* ─── ACT 3 today's funnel (4 to 10s) ──────────────────────────── */
        .v15-a3 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 4.1s forwards,
            vs-fade-out 0.5s 9.9s forwards;
        }
        .v15-a3-tag {
          position: absolute;
          top: 200px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.26em;
          color: rgba(248, 113, 113, 0.85);
          text-transform: uppercase;
        }
        .v15-a3-h {
          position: absolute;
          top: 250px;
          left: 30px;
          right: 30px;
          text-align: center;
          font-size: 60px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: #fff;
        }
        .v15-a3-steps {
          position: absolute;
          top: 440px;
          left: 60px;
          right: 60px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .v15-a3-step {
          display: grid;
          grid-template-columns: 56px 1fr auto;
          gap: 22px;
          align-items: center;
          padding: 24px 28px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          opacity: 0;
        }
        .v15-a3-step:nth-child(1) {
          animation: v15-pop-in 0.5s 4.4s forwards;
        }
        .v15-a3-step:nth-child(2) {
          animation: v15-pop-in 0.5s 5.4s forwards;
        }
        .v15-a3-step:nth-child(3) {
          animation: v15-pop-in 0.5s 6.4s forwards;
        }
        .v15-a3-step:nth-child(4) {
          animation: v15-pop-in 0.5s 7.4s forwards;
        }
        .v15-a3-step.is-bad {
          border-color: rgba(248, 113, 113, 0.4);
        }
        .v15-a3-num {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.7);
          letter-spacing: -0.01em;
        }
        .v15-a3-step.is-bad .v15-a3-num {
          background: rgba(248, 113, 113, 0.14);
          color: rgba(248, 113, 113, 0.95);
        }
        .v15-a3-body {
          display: flex;
          flex-direction: column;
        }
        .v15-a3-h2 {
          font-size: 30px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.018em;
          line-height: 1.15;
        }
        .v15-a3-b {
          margin-top: 4px;
          font-size: 19px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.3;
        }
        .v15-a3-pill {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          padding: 8px 14px;
          background: rgba(248, 113, 113, 0.14);
          border: 1px solid rgba(248, 113, 113, 0.4);
          border-radius: 999px;
          color: rgba(248, 113, 113, 0.95);
          white-space: nowrap;
        }
        .v15-a3-tally {
          position: absolute;
          bottom: 110px;
          left: 60px;
          right: 60px;
          text-align: center;
          padding: 26px 28px;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 20px;
          opacity: 0;
          animation: v15-pop-in 0.5s 8.4s forwards;
        }
        .v15-a3-tally-h {
          font-size: 38px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.022em;
          line-height: 1.15;
        }
        .v15-a3-tally-h em {
          font-style: normal;
          color: rgba(248, 113, 113, 0.95);
        }

        /* ─── ACT 4 pivot (10 to 11s) ──────────────────────────────────── */
        .v15-a4 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 10.1s forwards,
            vs-fade-out 0.3s 11s forwards;
        }
        .v15-a4-h {
          position: absolute;
          top: 800px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 76px;
          font-weight: 800;
          letter-spacing: -0.034em;
          color: #fff;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.4);
        }
        .v15-a4-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ─── ACT 5 MedPay multi-hop routing tree (11 to 20s) ─────────── */
        .v15-a5 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 11.1s forwards,
            vs-fade-out 0.5s 19.9s forwards;
        }
        .v15-a5-tag {
          position: absolute;
          top: 200px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.26em;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v15-a5-h {
          position: absolute;
          top: 250px;
          left: 30px;
          right: 30px;
          text-align: center;
          font-size: 56px;
          font-weight: 800;
          letter-spacing: -0.028em;
          line-height: 1.05;
          color: #fff;
        }
        .v15-a5-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* the SVG tree itself */
        .v15-tree {
          position: absolute;
          top: 380px;
          left: 24px;
          right: 24px;
          bottom: 200px;
          padding: 22px;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(34, 184, 160, 0.3);
          border-radius: 28px;
          box-shadow: 0 30px 80px -20px rgba(34, 184, 160, 0.35);
        }
        .v15-tree-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* dashed alternative edges */
        .v15-tree-edges-dashed path {
          fill: none;
          stroke: rgba(255, 255, 255, 0.18);
          stroke-width: 2;
          stroke-dasharray: 6 6;
        }
        /* solid traced edges (the one buyer's path) */
        .v15-tree-edges-solid path {
          fill: none;
          stroke: ${TEAL_2};
          stroke-width: 3.5;
          filter: drop-shadow(0 0 8px rgba(34, 184, 160, 0.55));
        }
        /* node rects */
        .v15-tree-node rect {
          fill: rgba(15, 23, 42, 0.92);
          stroke: rgba(255, 255, 255, 0.18);
          stroke-width: 1.6;
        }
        .v15-tree-node.is-traced rect {
          stroke: ${TEAL_2};
          stroke-width: 2.4;
          filter: drop-shadow(0 0 12px rgba(34, 184, 160, 0.55));
          fill: rgba(14, 124, 102, 0.2);
        }
        .v15-tree-node.is-root rect {
          fill: rgba(14, 124, 102, 0.32);
          stroke: ${TEAL_2};
          stroke-width: 2;
        }
        .v15-tree-node text {
          fill: rgba(255, 255, 255, 0.9);
          text-anchor: middle;
        }
        .v15-tree-node-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.16em;
          font-weight: 700;
          fill: ${TEAL_2};
        }
        .v15-tree-node-h {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.015em;
        }
        .v15-tree-node.is-root .v15-tree-node-h,
        .v15-tree-node.is-traced .v15-tree-node-h {
          fill: #fff;
        }

        /* the glowing buyer orb · uses SVG animateMotion */
        .v15-tree-orb {
          fill: #fff;
          filter: drop-shadow(0 0 6px #fff) drop-shadow(0 0 14px ${TEAL_2})
            drop-shadow(0 0 30px rgba(34, 184, 160, 0.85));
        }

        /* tally below the tree */
        .v15-a5-tally {
          position: absolute;
          bottom: 90px;
          left: 60px;
          right: 60px;
          text-align: center;
          padding: 22px 28px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.4), rgba(34, 184, 160, 0.2));
          border: 1px solid rgba(34, 184, 160, 0.55);
          border-radius: 20px;
          opacity: 0;
          animation: v15-pop-in 0.5s 18.6s forwards;
        }
        .v15-a5-tally-h {
          font-size: 34px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.022em;
          line-height: 1.15;
        }
        .v15-a5-tally-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ─── ACT 6 result (20 to 22s) ─────────────────────────────────── */
        .v15-a6 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 20.1s forwards,
            vs-fade-out 0.4s 21.9s forwards;
        }
        .v15-a6-h {
          position: absolute;
          top: 700px;
          left: 30px;
          right: 30px;
          text-align: center;
          font-size: 84px;
          font-weight: 800;
          letter-spacing: -0.036em;
          line-height: 1.04;
          color: #fff;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.4);
        }
        .v15-a6-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v15-a6-sub {
          position: absolute;
          top: 1040px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 28px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.55);
        }

        /* ─── ACT 7 stamp (22 to 24s) ──────────────────────────────────── */
        .v15-a7 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation: v15-blur-in 0.6s 22s forwards;
        }
        .v15-a7-pre {
          position: absolute;
          top: 680px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 32px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.65);
          letter-spacing: -0.005em;
        }
        .v15-a7-h {
          position: absolute;
          top: 760px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 110px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: ${TEAL_2};
          text-shadow: 0 0 80px rgba(34, 184, 160, 0.55);
        }
      `}
    >
      <Mark />
      <Tag>MedPay · for practice owners</Tag>

      {/* ─── ACT 1 hook · rhetorical question variant ─────────────────── */}
      <section className="v15-a1">
        <div className="v15-a1-pre">Practice owner</div>
        <h1 className="v15-a1-h">
          What if your calendar <em>only had buyers?</em>
        </h1>
        <div className="v15-a1-sub">
          <em>MedPay</em> pre-qualifies every lead before they book.
        </div>
      </section>

      {/* ─── ACT 2 tag ─────────────────────────────────────────────────── */}
      <section className="v15-a2">
        <h2 className="v15-a2-h">
          Here&apos;s how <em>most do it today.</em>
        </h2>
      </section>

      {/* ─── ACT 3 today's funnel ──────────────────────────────────────── */}
      <section className="v15-a3">
        <div className="v15-a3-tag">Today&apos;s funnel</div>
        <h3 className="v15-a3-h">Your day, every day.</h3>
        <div className="v15-a3-steps">
          <div className="v15-a3-step">
            <div className="v15-a3-num">1</div>
            <div className="v15-a3-body">
              <div className="v15-a3-h2">Lead fills your form.</div>
              <div className="v15-a3-b">Name, email, maybe a phone number.</div>
            </div>
            <div></div>
          </div>
          <div className="v15-a3-step is-bad">
            <div className="v15-a3-num">2</div>
            <div className="v15-a3-body">
              <div className="v15-a3-h2">Your closer dials every one.</div>
              <div className="v15-a3-b">No idea who can pay. Calls the whole list.</div>
            </div>
            <div className="v15-a3-pill">80 dials</div>
          </div>
          <div className="v15-a3-step is-bad">
            <div className="v15-a3-num">3</div>
            <div className="v15-a3-body">
              <div className="v15-a3-h2">Hours on unqualified buyers.</div>
              <div className="v15-a3-b">
                &ldquo;Just info.&rdquo; &ldquo;Can&apos;t afford.&rdquo; &ldquo;Maybe later.&rdquo;
              </div>
            </div>
            <div className="v15-a3-pill">~6 hrs</div>
          </div>
          <div className="v15-a3-step is-bad">
            <div className="v15-a3-num">4</div>
            <div className="v15-a3-body">
              <div className="v15-a3-h2">A few cases close.</div>
              <div className="v15-a3-b">The rest ghost, cancel, or decline at checkout.</div>
            </div>
            <div className="v15-a3-pill">Few</div>
          </div>
        </div>
        <div className="v15-a3-tally">
          <div className="v15-a3-tally-h">
            Your team is <em>bleeding hours.</em>
          </div>
        </div>
      </section>

      {/* ─── ACT 4 pivot ───────────────────────────────────────────────── */}
      <section className="v15-a4">
        <h2 className="v15-a4-h">
          Now here&apos;s <em>MedPay.</em>
        </h2>
      </section>

      {/* ─── ACT 5 MedPay routing tree ─────────────────────────────────── */}
      <section className="v15-a5">
        <div className="v15-a5-tag">The MedPay way · high-ticket flow</div>
        <h3 className="v15-a5-h">
          Qualified buyers sell. <em>The rest get a guide.</em>
        </h3>
        <div className="v15-tree">
          <svg
            viewBox="0 0 1000 1200"
            preserveAspectRatio="xMidYMid meet"
            className="v15-tree-svg"
            aria-label="MedPay high-ticket routing tree"
          >
            {/* solid teal edges along the qualified path */}
            <g className="v15-tree-edges-solid">
              {/* root to credit gate */}
              <path d="M280,100 L280,180" />
              {/* credit gate to income gate */}
              <path d="M280,280 L280,360" />
              {/* income gate to sales call */}
              <path d="M280,460 L280,540" />
              {/* sales call to lender mkt */}
              <path d="M280,720 L280,800" />
              {/* lender mkt to funded */}
              <path d="M280,900 L280,980" />
            </g>

            {/* NO branches off each gate · same solid teal but no orb traces them */}
            <g className="v15-tree-edges-solid" style={{ opacity: 0.55 }}>
              {/* credit NO → send guide */}
              <path d="M410,230 L580,230" />
              {/* income NO → send guide */}
              <path d="M410,410 L580,410" />
            </g>

            {/* hidden trace path the orb follows · qualified spine top to bottom */}
            <path
              id="v15-trace"
              d="M280,55 L280,230 L280,410 L280,630 L280,850 L280,1020"
              fill="none"
              stroke="none"
            />

            {/* L0 · lead capture */}
            <g className="v15-tree-node is-root">
              <rect x="150" y="20" width="260" height="80" rx="14" />
              <text className="v15-tree-node-tag" x="280" y="52">
                LEAD CAPTURE
              </text>
              <text className="v15-tree-node-h" x="280" y="82">
                Form submit
              </text>
            </g>

            {/* L1 · credit score gate */}
            <g className="v15-tree-node is-traced">
              <rect x="150" y="180" width="260" height="100" rx="14" />
              <text className="v15-tree-node-tag" x="280" y="212">
                HOP 1 · CREDIT SCORE
              </text>
              <text className="v15-tree-node-h" x="280" y="254" style={{ fontSize: 30 }}>
                ≥ 700?
              </text>
            </g>
            {/* L1 NO branch · send guide */}
            <g className="v15-tree-node">
              <rect x="580" y="180" width="320" height="100" rx="14" />
              <text className="v15-tree-node-tag" x="740" y="212">
                NO · SEND GUIDE
              </text>
              <text className="v15-tree-node-h" x="740" y="248" style={{ fontSize: 22 }}>
                Credit-building guide
              </text>
              <text
                className="v15-tree-node-tag"
                x="740"
                y="270"
                style={{ opacity: 0.55, fontSize: 11 }}
              >
                Nurture drip · re-engage later
              </text>
            </g>

            {/* L2 · income gate */}
            <g className="v15-tree-node is-traced">
              <rect x="150" y="360" width="260" height="100" rx="14" />
              <text className="v15-tree-node-tag" x="280" y="392">
                HOP 2 · INCOME
              </text>
              <text className="v15-tree-node-h" x="280" y="434" style={{ fontSize: 30 }}>
                ≥ $80k?
              </text>
            </g>
            {/* L2 NO branch · send guide */}
            <g className="v15-tree-node">
              <rect x="580" y="360" width="320" height="100" rx="14" />
              <text className="v15-tree-node-tag" x="740" y="392">
                NO · SEND GUIDE
              </text>
              <text className="v15-tree-node-h" x="740" y="428" style={{ fontSize: 22 }}>
                Planning guide
              </text>
              <text
                className="v15-tree-node-tag"
                x="740"
                y="450"
                style={{ opacity: 0.55, fontSize: 11 }}
              >
                Save · plan · re-qualify later
              </text>
            </g>

            {/* L3 · sales call HERO */}
            <g className="v15-tree-node is-traced">
              <rect x="80" y="540" width="400" height="180" rx="18" />
              <text className="v15-tree-node-tag" x="280" y="580" style={{ fontSize: 14 }}>
                SALES CALL
              </text>
              <text className="v15-tree-node-h" x="280" y="630" style={{ fontSize: 32 }}>
                Qualified buyer
              </text>
              <text
                className="v15-tree-node-tag"
                x="280"
                y="665"
                style={{ opacity: 0.7, fontSize: 13 }}
              >
                Pre-approved budget attached
              </text>
              <text
                className="v15-tree-node-tag"
                x="280"
                y="690"
                style={{ opacity: 0.55, fontSize: 12 }}
              >
                Closer only talks to buyers
              </text>
            </g>

            {/* L4 · lender marketplace */}
            <g className="v15-tree-node is-traced">
              <rect x="100" y="800" width="360" height="100" rx="14" />
              <text className="v15-tree-node-tag" x="280" y="832">
                LENDER MARKETPLACE
              </text>
              <text className="v15-tree-node-h" x="280" y="874" style={{ fontSize: 20 }}>
                1 app · 5 lenders · instant
              </text>
            </g>

            {/* L5 · funded */}
            <g className="v15-tree-node is-traced">
              <rect x="170" y="980" width="220" height="100" rx="14" />
              <text className="v15-tree-node-tag" x="280" y="1012">
                OUTCOME
              </text>
              <text className="v15-tree-node-h" x="280" y="1054" style={{ fontSize: 34 }}>
                Funded.
              </text>
            </g>

            {/* the glowing orb */}
            <circle r="16" className="v15-tree-orb">
              <animateMotion dur="8s" begin="11.5s" fill="freeze" rotate="auto">
                <mpath href="#v15-trace" />
              </animateMotion>
            </circle>
          </svg>
        </div>
        <div className="v15-a5-tally">
          <div className="v15-a5-tally-h">
            Every lead handled. <em>Nothing wasted.</em>
          </div>
        </div>
      </section>

      {/* ─── ACT 6 result ──────────────────────────────────────────────── */}
      <section className="v15-a6">
        <h2 className="v15-a6-h">
          <em>Qualified</em> buyers.
          <br />
          <em>Booked</em> calls.
          <br />
          <em>Funded</em> same day.
        </h2>
        <div className="v15-a6-sub">No more wasted hours.</div>
      </section>

      {/* ─── ACT 7 stamp ───────────────────────────────────────────────── */}
      <section className="v15-a7">
        <div className="v15-a7-pre">That&apos;s</div>
        <h2 className="v15-a7-h">MedPay.</h2>
      </section>

      <Cta label="Book a 15-min walkthrough" ctaDelay={24.2} disclDelay={24.6} />
    </VideoStage>
  );
}
