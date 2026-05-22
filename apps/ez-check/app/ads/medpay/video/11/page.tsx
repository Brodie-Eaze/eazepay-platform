/**
 * Video ad V11 — "How MedPay works · lead → funded"  ·  20s  ·  1080×1920
 *
 * Flagship flow explainer. A glowing buyer-orb travels down an SVG path
 * through the MedPay agent stack. At each stage the corresponding panel
 * lights up + a data chip flies into the side-rail. By the end the
 * sidebar has accumulated the full pre-qual + finance record.
 *
 *  Stages the orb traverses:
 *    0.5–3.5s   HELIX · Smart form     · 4 fields auto-fill
 *    3.5–7.0s   ORACLE · Pre-qual       · 3 agents return (credit · income · tier)
 *    7.0–9.5s   HELIX · Smart routing   · gate decides "Tier A → senior closer"
 *    9.5–13.5s  NEXUS · Finance rails   · 3 rails pre-approve in parallel
 *   13.5–16.5s  Calendar · booked · funded
 *   16.5–18.5s  full payload "what just happened" recap
 *   18.5–20s    CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV11(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        /* opening eyebrow + headline */
        .v11-eyebrow {
          position: absolute;
          top: 180px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation:
            vs-in-up 0.6s 0.4s forwards,
            vs-fade-out 0.4s 16s forwards;
        }
        @keyframes vs-fade-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .v11-h {
          position: absolute;
          top: 240px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.034em;
          line-height: 1.04;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.3);
          opacity: 0;
          animation:
            vs-in-up 0.6s 0.6s forwards,
            vs-fade-out 0.4s 16s forwards;
        }
        .v11-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* SVG flow scene — orb travels through stages */
        .v11-flow {
          position: absolute;
          top: 380px;
          left: 30px;
          right: 30px;
          height: 1380px;
          animation: vs-fade-out 0.5s 16s forwards;
        }
        .v11-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .v11-edge {
          fill: none;
          stroke: rgba(34, 184, 160, 0.35);
          stroke-width: 2;
          stroke-dasharray: 5 5;
          animation: v11-edge-dash 4s linear infinite;
        }
        @keyframes v11-edge-dash {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -100;
          }
        }

        .v11-orb {
          fill: #fff;
          filter: drop-shadow(0 0 18px ${TEAL_2}) drop-shadow(0 0 36px rgba(34, 184, 160, 0.55));
        }

        /* stage panels — overlaid HTML divs positioned on top of the SVG */
        .v11-stage {
          position: absolute;
          left: 30px;
          right: 30px;
          padding: 18px 22px;
          border-radius: 22px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.12), transparent 60%),
            rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(34, 184, 160, 0.22);
          backdrop-filter: blur(14px);
          opacity: 0.35;
          transition:
            opacity 0.3s ease,
            border-color 0.3s ease,
            box-shadow 0.3s ease;
        }
        .v11-stage.is-active {
          opacity: 1;
          border-color: rgba(34, 184, 160, 0.7);
          box-shadow: 0 30px 60px -16px rgba(34, 184, 160, 0.4);
        }
        .v11-stage-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v11-stage-h {
          margin-top: 6px;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.018em;
          color: #fff;
        }
        .v11-stage-b {
          margin-top: 4px;
          font-size: 15px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.62);
        }

        /* timed activations on the stage panels */
        .v11-s1 {
          top: 100px;
          animation: v11-pulse 0.4s 0.8s forwards;
        }
        .v11-s2 {
          top: 380px;
          animation: v11-pulse 0.4s 3.8s forwards;
        }
        .v11-s3 {
          top: 660px;
          animation: v11-pulse 0.4s 7.2s forwards;
        }
        .v11-s4 {
          top: 940px;
          animation: v11-pulse 0.4s 9.8s forwards;
        }
        .v11-s5 {
          top: 1220px;
          animation: v11-pulse 0.4s 13.8s forwards;
        }
        @keyframes v11-pulse {
          0% {
            opacity: 0.35;
            border-color: rgba(34, 184, 160, 0.22);
            box-shadow: none;
          }
          100% {
            opacity: 1;
            border-color: rgba(34, 184, 160, 0.7);
            box-shadow: 0 30px 60px -16px rgba(34, 184, 160, 0.4);
          }
        }

        /* mini data chips inside each stage */
        .v11-chips {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .v11-chip {
          padding: 6px 12px;
          background: rgba(34, 184, 160, 0.18);
          border: 1px solid rgba(34, 184, 160, 0.4);
          border-radius: 999px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          font-weight: 700;
          color: ${TEAL_2};
          opacity: 0;
        }
        /* stage-1 (HELIX form) chips fade in 1.5–3.5s */
        .v11-s1 .v11-chip:nth-child(1) {
          animation: vs-in-up 0.3s 1.4s forwards;
        }
        .v11-s1 .v11-chip:nth-child(2) {
          animation: vs-in-up 0.3s 1.8s forwards;
        }
        .v11-s1 .v11-chip:nth-child(3) {
          animation: vs-in-up 0.3s 2.2s forwards;
        }
        .v11-s1 .v11-chip:nth-child(4) {
          animation: vs-in-up 0.3s 2.6s forwards;
        }
        /* stage-2 (ORACLE) chips fade in 4.5–6.5s */
        .v11-s2 .v11-chip:nth-child(1) {
          animation: vs-in-up 0.3s 4.6s forwards;
        }
        .v11-s2 .v11-chip:nth-child(2) {
          animation: vs-in-up 0.3s 5.2s forwards;
        }
        .v11-s2 .v11-chip:nth-child(3) {
          animation: vs-in-up 0.3s 5.8s forwards;
        }
        /* stage-3 (smart routing) chip */
        .v11-s3 .v11-chip:nth-child(1) {
          animation: vs-in-up 0.3s 7.8s forwards;
        }
        /* stage-4 (NEXUS rails) — 3 rails 10.4 / 10.9 / 11.4 */
        .v11-s4 .v11-chip:nth-child(1) {
          animation: vs-in-up 0.3s 10.4s forwards;
        }
        .v11-s4 .v11-chip:nth-child(2) {
          animation: vs-in-up 0.3s 10.9s forwards;
        }
        .v11-s4 .v11-chip:nth-child(3) {
          animation: vs-in-up 0.3s 11.4s forwards;
        }
        /* stage-5 (calendar) chips */
        .v11-s5 .v11-chip:nth-child(1) {
          animation: vs-in-up 0.3s 14.2s forwards;
        }
        .v11-s5 .v11-chip:nth-child(2) {
          animation: vs-in-up 0.3s 14.6s forwards;
        }

        /* recap stamp — Act 6 (16–18.5s) */
        .v11-recap {
          position: absolute;
          top: 240px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: v11-recap-in 0.7s 16.2s forwards;
        }
        @keyframes v11-recap-in {
          0% {
            opacity: 0;
            filter: blur(20px);
            transform: scale(1.04);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
          }
        }
        .v11-recap-eyebrow {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v11-recap-h {
          margin-top: 14px;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.04;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.4);
        }
        .v11-recap-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>How MedPay works</Tag>

      <div className="v11-eyebrow">Lead → Funded · 15 seconds</div>
      <h1 className="v11-h">
        One inbound lead. <em>One MedPay run.</em>
      </h1>

      {/* SVG flow scene with orb traveling through path */}
      <div className="v11-flow">
        <svg className="v11-svg" viewBox="0 0 1020 1380" preserveAspectRatio="xMidYMid meet">
          {/* spine path the orb follows */}
          <path
            id="v11-spine"
            d="M 510 60
               C 510 200, 510 250, 510 360
               C 510 470, 510 520, 510 640
               C 510 760, 510 800, 510 920
               C 510 1040, 510 1080, 510 1200
               C 510 1280, 510 1300, 510 1340"
            className="v11-edge"
          />
          {/* the orb */}
          <circle r="14" className="v11-orb">
            <animateMotion dur="15s" fill="freeze" rotate="auto">
              <mpath href="#v11-spine" />
            </animateMotion>
          </circle>
        </svg>

        {/* Stage panels overlaid on the SVG */}
        <article className="v11-stage v11-s1">
          <div className="v11-stage-tag">01 · HELIX · Smart form</div>
          <div className="v11-stage-h">Lead lands. Form reshapes itself.</div>
          <div className="v11-stage-b">4 fields. Auto-advance. Mobile-first.</div>
          <div className="v11-chips">
            <span className="v11-chip">Email ✓</span>
            <span className="v11-chip">DOB ✓</span>
            <span className="v11-chip">Last 4 ✓</span>
            <span className="v11-chip">Budget ✓</span>
          </div>
        </article>

        <article className="v11-stage v11-s2">
          <div className="v11-stage-tag">02 · ORACLE · Pre-qual agents</div>
          <div className="v11-stage-h">3 agents run in parallel. &lt; 3s.</div>
          <div className="v11-stage-b">Soft-pull · income capacity · fundability composite.</div>
          <div className="v11-chips">
            <span className="v11-chip">Credit · 724</span>
            <span className="v11-chip">Income · $98k</span>
            <span className="v11-chip">Tier · A</span>
          </div>
        </article>

        <article className="v11-stage v11-s3">
          <div className="v11-stage-tag">03 · HELIX · Smart routing</div>
          <div className="v11-stage-h">Tier A → senior closer calendar.</div>
          <div className="v11-stage-b">Multi-hop gates. Each one A/B-testable.</div>
          <div className="v11-chips">
            <span className="v11-chip">Sarah · Thu 2:00 PM ✓</span>
          </div>
        </article>

        <article className="v11-stage v11-s4">
          <div className="v11-stage-tag">04 · NEXUS · Lender marketplace</div>
          <div className="v11-stage-h">3 finance rails quote in parallel.</div>
          <div className="v11-stage-b">
            Consumer-direct, merchant-direct, BNPL — all pre-approved.
          </div>
          <div className="v11-chips">
            <span className="v11-chip">Consumer · $14,200</span>
            <span className="v11-chip">Merchant · $18,500</span>
            <span className="v11-chip">BNPL · $5,000</span>
          </div>
        </article>

        <article className="v11-stage v11-s5">
          <div className="v11-stage-tag">05 · Funded</div>
          <div className="v11-stage-h">Lender wires merchant-direct · 48hr.</div>
          <div className="v11-stage-b">Patient on calendar. Wire scheduled. Done.</div>
          <div className="v11-chips">
            <span className="v11-chip">$14,200 funded</span>
            <span className="v11-chip">48-hour wire</span>
          </div>
        </article>
      </div>

      <div className="v11-recap">
        <div className="v11-recap-eyebrow">From lead to funded · 8.7s</div>
        <div className="v11-recap-h">
          That&apos;s <em>MedPay.</em>
        </div>
      </div>

      <Cta label="See it run on your funnel" ctaDelay={17.8} disclDelay={18.2} />
    </VideoStage>
  );
}
