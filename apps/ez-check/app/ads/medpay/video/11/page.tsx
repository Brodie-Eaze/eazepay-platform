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

export default function MedPayVideoV11(): JSX.Element {
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
        @keyframes v11-pop-in {
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
        @keyframes v11-blur-in {
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
        .v11-a1 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 0.2s forwards,
            vs-fade-out 0.5s 3s forwards;
        }
        .v11-a1-pre {
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
          animation: v11-blur-in 0.5s 0.4s forwards;
        }
        .v11-a1-h {
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
          animation: v11-blur-in 0.6s 0.9s forwards;
        }
        .v11-a1-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-a1-sub {
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
        .v11-a2 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 3.1s forwards,
            vs-fade-out 0.3s 4s forwards;
        }
        .v11-a2-h {
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
        .v11-a2-h em {
          font-style: normal;
          color: rgba(248, 113, 113, 0.9);
        }

        /* ─── ACT 3 today's funnel (4 to 10s) ──────────────────────────── */
        .v11-a3 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 4.1s forwards,
            vs-fade-out 0.5s 9.9s forwards;
        }
        .v11-a3-tag {
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
        .v11-a3-h {
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
        .v11-a3-steps {
          position: absolute;
          top: 440px;
          left: 60px;
          right: 60px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .v11-a3-step {
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
        .v11-a3-step:nth-child(1) {
          animation: v11-pop-in 0.5s 4.4s forwards;
        }
        .v11-a3-step:nth-child(2) {
          animation: v11-pop-in 0.5s 5.4s forwards;
        }
        .v11-a3-step:nth-child(3) {
          animation: v11-pop-in 0.5s 6.4s forwards;
        }
        .v11-a3-step:nth-child(4) {
          animation: v11-pop-in 0.5s 7.4s forwards;
        }
        .v11-a3-step.is-bad {
          border-color: rgba(248, 113, 113, 0.4);
        }
        .v11-a3-num {
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
        .v11-a3-step.is-bad .v11-a3-num {
          background: rgba(248, 113, 113, 0.14);
          color: rgba(248, 113, 113, 0.95);
        }
        .v11-a3-body {
          display: flex;
          flex-direction: column;
        }
        .v11-a3-h2 {
          font-size: 30px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.018em;
          line-height: 1.15;
        }
        .v11-a3-b {
          margin-top: 4px;
          font-size: 19px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.3;
        }
        .v11-a3-pill {
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
        .v11-a3-tally {
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
          animation: v11-pop-in 0.5s 8.4s forwards;
        }
        .v11-a3-tally-h {
          font-size: 38px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.022em;
          line-height: 1.15;
        }
        .v11-a3-tally-h em {
          font-style: normal;
          color: rgba(248, 113, 113, 0.95);
        }

        /* ─── ACT 4 pivot (10 to 11s) ──────────────────────────────────── */
        .v11-a4 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 10.1s forwards,
            vs-fade-out 0.3s 11s forwards;
        }
        .v11-a4-h {
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
        .v11-a4-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ─── ACT 5 MedPay multi-hop routing tree (11 to 20s) ─────────── */
        .v11-a5 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 11.1s forwards,
            vs-fade-out 0.5s 19.9s forwards;
        }
        .v11-a5-tag {
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
        .v11-a5-h {
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
        .v11-a5-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* the SVG tree itself */
        .v11-tree {
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
        .v11-tree-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* dashed alternative edges */
        .v11-tree-edges-dashed path {
          fill: none;
          stroke: rgba(255, 255, 255, 0.18);
          stroke-width: 2;
          stroke-dasharray: 6 6;
        }
        /* solid traced edges (the one buyer's path) */
        .v11-tree-edges-solid path {
          fill: none;
          stroke: ${TEAL_2};
          stroke-width: 3.5;
          filter: drop-shadow(0 0 8px rgba(34, 184, 160, 0.55));
        }
        /* node rects */
        .v11-tree-node rect {
          fill: rgba(15, 23, 42, 0.92);
          stroke: rgba(255, 255, 255, 0.18);
          stroke-width: 1.6;
        }
        .v11-tree-node.is-traced rect {
          stroke: ${TEAL_2};
          stroke-width: 2.4;
          filter: drop-shadow(0 0 12px rgba(34, 184, 160, 0.55));
          fill: rgba(14, 124, 102, 0.2);
        }
        .v11-tree-node.is-root rect {
          fill: rgba(14, 124, 102, 0.32);
          stroke: ${TEAL_2};
          stroke-width: 2;
        }
        .v11-tree-node text {
          fill: rgba(255, 255, 255, 0.9);
          text-anchor: middle;
        }
        .v11-tree-node-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.16em;
          font-weight: 700;
          fill: ${TEAL_2};
        }
        .v11-tree-node-h {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.015em;
        }
        .v11-tree-node.is-root .v11-tree-node-h,
        .v11-tree-node.is-traced .v11-tree-node-h {
          fill: #fff;
        }

        /* the glowing buyer orb · uses SVG animateMotion */
        .v11-tree-orb {
          fill: #fff;
          filter: drop-shadow(0 0 6px #fff) drop-shadow(0 0 14px ${TEAL_2})
            drop-shadow(0 0 30px rgba(34, 184, 160, 0.85));
        }

        /* tally below the tree */
        .v11-a5-tally {
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
          animation: v11-pop-in 0.5s 18.6s forwards;
        }
        .v11-a5-tally-h {
          font-size: 34px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.022em;
          line-height: 1.15;
        }
        .v11-a5-tally-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ─── ACT 6 result (20 to 22s) ─────────────────────────────────── */
        .v11-a6 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 20.1s forwards,
            vs-fade-out 0.4s 21.9s forwards;
        }
        .v11-a6-h {
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
        .v11-a6-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-a6-sub {
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
        .v11-a7 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation: v11-blur-in 0.6s 22s forwards;
        }
        .v11-a7-pre {
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
        .v11-a7-h {
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

      {/* ─── ACT 1 hook ────────────────────────────────────────────────── */}
      <section className="v11-a1">
        <div className="v11-a1-pre">Practice owner.</div>
        <h1 className="v11-a1-h">
          There are <em>two ways</em> to run your clinic.
        </h1>
        <div className="v11-a1-sub">Let&apos;s look at both.</div>
      </section>

      {/* ─── ACT 2 tag ─────────────────────────────────────────────────── */}
      <section className="v11-a2">
        <h2 className="v11-a2-h">
          Here&apos;s how <em>most do it today.</em>
        </h2>
      </section>

      {/* ─── ACT 3 today's funnel ──────────────────────────────────────── */}
      <section className="v11-a3">
        <div className="v11-a3-tag">Today&apos;s funnel</div>
        <h3 className="v11-a3-h">Your day, every day.</h3>
        <div className="v11-a3-steps">
          <div className="v11-a3-step">
            <div className="v11-a3-num">1</div>
            <div className="v11-a3-body">
              <div className="v11-a3-h2">Lead fills your form.</div>
              <div className="v11-a3-b">Name, email, maybe a phone number.</div>
            </div>
            <div></div>
          </div>
          <div className="v11-a3-step is-bad">
            <div className="v11-a3-num">2</div>
            <div className="v11-a3-body">
              <div className="v11-a3-h2">Your closer dials every one.</div>
              <div className="v11-a3-b">No idea who can pay. Calls the whole list.</div>
            </div>
            <div className="v11-a3-pill">80 dials</div>
          </div>
          <div className="v11-a3-step is-bad">
            <div className="v11-a3-num">3</div>
            <div className="v11-a3-body">
              <div className="v11-a3-h2">Hours on unqualified buyers.</div>
              <div className="v11-a3-b">
                &ldquo;Just info.&rdquo; &ldquo;Can&apos;t afford.&rdquo; &ldquo;Maybe later.&rdquo;
              </div>
            </div>
            <div className="v11-a3-pill">~6 hrs</div>
          </div>
          <div className="v11-a3-step is-bad">
            <div className="v11-a3-num">4</div>
            <div className="v11-a3-body">
              <div className="v11-a3-h2">A few cases close.</div>
              <div className="v11-a3-b">The rest ghost, cancel, or decline at checkout.</div>
            </div>
            <div className="v11-a3-pill">Few</div>
          </div>
        </div>
        <div className="v11-a3-tally">
          <div className="v11-a3-tally-h">
            Your team is <em>bleeding hours.</em>
          </div>
        </div>
      </section>

      {/* ─── ACT 4 pivot ───────────────────────────────────────────────── */}
      <section className="v11-a4">
        <h2 className="v11-a4-h">
          Now here&apos;s <em>MedPay.</em>
        </h2>
      </section>

      {/* ─── ACT 5 MedPay routing tree ─────────────────────────────────── */}
      <section className="v11-a5">
        <div className="v11-a5-tag">The MedPay way</div>
        <h3 className="v11-a5-h">
          Three financial gates. <em>Qualified buyer.</em>
        </h3>
        <div className="v11-tree">
          <svg
            viewBox="0 0 1000 1300"
            preserveAspectRatio="xMidYMid meet"
            className="v11-tree-svg"
            aria-label="Three-gate financial qualification tree"
          >
            {/* dashed alternative edges · what happens to non-qualifiers */}
            <g className="v11-tree-edges-dashed">
              <path d="M400,205 L280,205" />
              <path d="M400,365 L280,365" />
              <path d="M400,525 L280,525" />
            </g>

            {/* solid traced edges along the qualified buyer's path */}
            <g className="v11-tree-edges-solid">
              <path d="M500,80 L500,165" />
              <path d="M500,245 L500,325" />
              <path d="M500,405 L500,485" />
              <path d="M500,565 L500,645" />
              <path d="M500,790 L500,865" />
              <path d="M500,945 L500,1020" />
            </g>

            {/* hidden trace path the orb follows · top to bottom */}
            <path
              id="v11-trace"
              d="M500,50 L500,205 L500,365 L500,525 L500,715 L500,905 L500,1060"
              fill="none"
              stroke="none"
            />

            {/* L0 · lead capture */}
            <g className="v11-tree-node is-root">
              <rect x="380" y="20" width="240" height="60" rx="14" />
              <text className="v11-tree-node-tag" x="500" y="42">
                LEAD CAPTURE
              </text>
              <text className="v11-tree-node-h" x="500" y="65">
                Form submit
              </text>
            </g>

            {/* L1 · credit score · gate 1 */}
            <g className="v11-tree-node is-traced">
              <rect x="380" y="165" width="240" height="80" rx="14" />
              <text className="v11-tree-node-tag" x="500" y="190">
                HOP 1 · CREDIT SCORE
              </text>
              <text className="v11-tree-node-h" x="500" y="220">
                ≥ 700?
              </text>
              <text className="v11-tree-node-tag" x="500" y="237" style={{ opacity: 0.55 }}>
                ✓ Pass · high-ticket lane
              </text>
            </g>
            {/* L1 alt · low-ticket lane */}
            <g className="v11-tree-node">
              <rect x="60" y="175" width="220" height="60" rx="14" />
              <text className="v11-tree-node-tag" x="170" y="197">
                ALT · LOW-TICKET LANE
              </text>
              <text className="v11-tree-node-h" x="170" y="220" style={{ fontSize: 14 }}>
                Self-serve checkout
              </text>
            </g>

            {/* L2 · income · gate 2 */}
            <g className="v11-tree-node is-traced">
              <rect x="380" y="325" width="240" height="80" rx="14" />
              <text className="v11-tree-node-tag" x="500" y="350">
                HOP 2 · INCOME
              </text>
              <text className="v11-tree-node-h" x="500" y="380">
                ≥ $80k / yr?
              </text>
              <text className="v11-tree-node-tag" x="500" y="397" style={{ opacity: 0.55 }}>
                ✓ Pass · income qualified
              </text>
            </g>
            {/* L2 alt · consult */}
            <g className="v11-tree-node">
              <rect x="60" y="335" width="220" height="60" rx="14" />
              <text className="v11-tree-node-tag" x="170" y="357">
                ALT · CONSULT
              </text>
              <text className="v11-tree-node-h" x="170" y="380" style={{ fontSize: 14 }}>
                Right-sized offer
              </text>
            </g>

            {/* L3 · available credit · gate 3 */}
            <g className="v11-tree-node is-traced">
              <rect x="380" y="485" width="240" height="80" rx="14" />
              <text className="v11-tree-node-tag" x="500" y="510">
                HOP 3 · AVAILABLE CREDIT
              </text>
              <text className="v11-tree-node-h" x="500" y="540">
                Headroom ≥ $15k?
              </text>
              <text className="v11-tree-node-tag" x="500" y="557" style={{ opacity: 0.55 }}>
                ✓ Pass · ready to fund
              </text>
            </g>
            {/* L3 alt · BNPL */}
            <g className="v11-tree-node">
              <rect x="60" y="495" width="220" height="60" rx="14" />
              <text className="v11-tree-node-tag" x="170" y="517">
                ALT · BNPL OR DECLINE
              </text>
              <text className="v11-tree-node-h" x="170" y="540" style={{ fontSize: 14 }}>
                Klarna / Affirm
              </text>
            </g>

            {/* L4 · sales call · HERO QUALIFIED BUYER */}
            <g className="v11-tree-node is-traced">
              <rect x="320" y="645" width="360" height="145" rx="18" />
              <text className="v11-tree-node-tag" x="500" y="675" style={{ fontSize: 13 }}>
                SALES CALL
              </text>
              <text className="v11-tree-node-h" x="500" y="715" style={{ fontSize: 22 }}>
                Qualified buyer
              </text>
              <text className="v11-tree-node-tag" x="500" y="745" style={{ opacity: 0.65 }}>
                Pre-approved budget attached
              </text>
              <text className="v11-tree-node-tag" x="500" y="765" style={{ opacity: 0.55 }}>
                Closer only talks to buyers who can pay
              </text>
            </g>

            {/* L5 · lender marketplace */}
            <g className="v11-tree-node is-traced">
              <rect x="350" y="865" width="300" height="80" rx="14" />
              <text className="v11-tree-node-tag" x="500" y="890">
                LENDER MARKETPLACE
              </text>
              <text className="v11-tree-node-h" x="500" y="918" style={{ fontSize: 16 }}>
                1 app · 5 lenders · instant
              </text>
              <text className="v11-tree-node-tag" x="500" y="935" style={{ opacity: 0.55 }}>
                Best terms picked automatically
              </text>
            </g>

            {/* L6 · funded */}
            <g className="v11-tree-node is-traced">
              <rect x="390" y="1020" width="220" height="80" rx="14" />
              <text className="v11-tree-node-tag" x="500" y="1045">
                OUTCOME
              </text>
              <text className="v11-tree-node-h" x="500" y="1078" style={{ fontSize: 28 }}>
                Funded.
              </text>
            </g>

            {/* the glowing orb */}
            <circle r="16" className="v11-tree-orb">
              <animateMotion dur="8s" begin="11.5s" fill="freeze" rotate="auto">
                <mpath href="#v11-trace" />
              </animateMotion>
            </circle>
          </svg>
        </div>
        <div className="v11-a5-tally">
          <div className="v11-a5-tally-h">
            Three gates. <em>One qualified buyer.</em>
          </div>
        </div>
      </section>

      {/* ─── ACT 6 result ──────────────────────────────────────────────── */}
      <section className="v11-a6">
        <h2 className="v11-a6-h">
          <em>Qualified</em> buyers.
          <br />
          <em>Booked</em> calls.
          <br />
          <em>Funded</em> same day.
        </h2>
        <div className="v11-a6-sub">No more wasted hours.</div>
      </section>

      {/* ─── ACT 7 stamp ───────────────────────────────────────────────── */}
      <section className="v11-a7">
        <div className="v11-a7-pre">That&apos;s</div>
        <h2 className="v11-a7-h">MedPay.</h2>
      </section>

      <Cta label="Book a 15-min walkthrough" ctaDelay={24.2} disclDelay={24.6} />
    </VideoStage>
  );
}
