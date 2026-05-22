/**
 * Video ad V12 — "Meet the agents"  ·  17s  ·  1080×1920
 *
 * Introduces the three named agents that make MedPay work. Each agent
 * card flies in with code + role + 3 output chips. At the end the
 * three cards line up + connectors fire showing how they orchestrate.
 *
 *  0.0–1.0   stage in
 *  1.0–2.5   "Meet the agents" headline
 *  2.5–5.5   HELIX card (Smart form + smart routing)
 *  5.5–8.5   ORACLE card (Pre-qualification)
 *  8.5–11.5  NEXUS card (Lender marketplace)
 * 11.5–13.5  three cards shrink + line up; orchestration lines fire
 * 13.5–15.0  "One platform · 8.7s lead-to-funded" stamp
 * 15.0–17.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV12(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        .v12-eyebrow {
          position: absolute;
          top: 220px;
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
          animation: vs-in-up 0.6s 0.8s forwards;
        }
        .v12-h {
          position: absolute;
          top: 280px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 80px;
          font-weight: 800;
          letter-spacing: -0.034em;
          line-height: 1.04;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.3);
          opacity: 0;
          animation: vs-in-up 0.6s 1s forwards;
        }
        .v12-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* large agent intro cards — one at a time, each full-frame */
        .v12-agent {
          position: absolute;
          top: 500px;
          left: 64px;
          right: 64px;
          padding: 44px;
          border-radius: 32px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.22), transparent 65%),
            rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(34, 184, 160, 0.55);
          box-shadow: 0 60px 120px -30px rgba(34, 184, 160, 0.45);
          backdrop-filter: blur(18px);
          opacity: 0;
        }
        .v12-agent-1 {
          animation:
            vs-card-in 0.7s 2.5s forwards,
            vs-card-out 0.5s 5.4s forwards;
        }
        .v12-agent-2 {
          animation:
            vs-card-in 0.7s 5.5s forwards,
            vs-card-out 0.5s 8.4s forwards;
        }
        .v12-agent-3 {
          animation:
            vs-card-in 0.7s 8.5s forwards,
            vs-card-out 0.5s 11.4s forwards;
        }
        @keyframes vs-card-in {
          0% {
            opacity: 0;
            transform: translateY(60px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes vs-card-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-40px) scale(0.96);
          }
        }
        .v12-agent-row {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .v12-glyph {
          width: 120px;
          height: 120px;
          border-radius: 28px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 20px 40px -12px rgba(34, 184, 160, 0.55);
        }
        .v12-agent-text {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .v12-agent-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 16px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v12-agent-name {
          font-size: 80px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 0.95;
          color: #fff;
        }
        .v12-agent-role {
          margin-top: 4px;
          font-size: 26px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.78);
        }
        .v12-agent-body {
          margin-top: 28px;
          font-size: 28px;
          font-weight: 600;
          line-height: 1.32;
          color: rgba(255, 255, 255, 0.86);
          letter-spacing: -0.014em;
        }
        .v12-agent-chips {
          margin-top: 26px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .v12-agent-chip {
          padding: 10px 16px;
          background: rgba(34, 184, 160, 0.18);
          border: 1px solid rgba(34, 184, 160, 0.42);
          border-radius: 999px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 16px;
          font-weight: 700;
          color: ${TEAL_2};
        }

        /* orchestration shot — 3 small cards in a row + connectors */
        .v12-orch {
          position: absolute;
          top: 540px;
          left: 64px;
          right: 64px;
          opacity: 0;
          animation: vs-in-up 0.7s 11.5s forwards;
        }
        .v12-orch-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }
        .v12-orch-cell {
          padding: 26px 22px;
          border-radius: 22px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.18), transparent 65%),
            rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(34, 184, 160, 0.45);
          text-align: center;
          backdrop-filter: blur(14px);
        }
        .v12-orch-glyph {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          margin: 0 auto;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .v12-orch-name {
          margin-top: 14px;
          font-size: 30px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .v12-orch-role {
          margin-top: 4px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.62);
          line-height: 1.4;
        }
        /* edges between orchestration cells */
        .v12-orch-edges {
          margin-top: 24px;
          height: 60px;
          position: relative;
        }
        .v12-orch-svg {
          width: 100%;
          height: 100%;
        }
        .v12-orch-edge {
          fill: none;
          stroke: rgba(34, 184, 160, 0.55);
          stroke-width: 2;
          stroke-dasharray: 5 5;
          animation:
            v12-edge-dash 3s linear infinite,
            v12-edge-in 0.5s 12s forwards;
          stroke-dashoffset: 200;
        }
        @keyframes v12-edge-dash {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: -100;
          }
        }
        @keyframes v12-edge-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .v12-orch-outcome {
          margin-top: 0;
          padding: 22px 28px;
          background: linear-gradient(135deg, rgba(34, 184, 160, 0.45), rgba(14, 124, 102, 0.55));
          border: 1px solid rgba(34, 184, 160, 0.7);
          border-radius: 18px;
          text-align: center;
          color: #fff;
          opacity: 0;
          animation: vs-in-up 0.5s 12.6s forwards;
        }
        .v12-orch-outcome-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 14px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.78);
          text-transform: uppercase;
        }
        .v12-orch-outcome-h {
          margin-top: 8px;
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -0.022em;
        }

        /* big stamp at end */
        .v12-stamp {
          position: absolute;
          top: 1340px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 70px;
          font-weight: 800;
          letter-spacing: -0.032em;
          line-height: 1.04;
          color: #fff;
          opacity: 0;
          animation: vs-stamp-in 0.55s 13.6s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        @keyframes vs-stamp-in {
          0% {
            opacity: 0;
            transform: scale(1.3);
          }
          70% {
            opacity: 1;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .v12-stamp em {
          font-style: normal;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>Meet the agents</Tag>

      <div className="v12-eyebrow">The agent stack</div>
      <h1 className="v12-h">
        3 agents.
        <br />
        <em>One platform.</em>
      </h1>

      {/* HELIX */}
      <article className="v12-agent v12-agent-1">
        <div className="v12-agent-row">
          <span className="v12-glyph" aria-hidden>
            <svg width="64" height="64" viewBox="0 0 40 40" fill="none">
              <path
                d="M10 6 Q20 14 30 6 Q20 14 10 22 Q20 30 30 22 Q20 30 10 38"
                stroke="currentColor"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="10" cy="6" r="2.4" fill="currentColor" />
              <circle cx="30" cy="6" r="2.4" fill="currentColor" />
              <circle cx="10" cy="22" r="2.4" fill="currentColor" />
              <circle cx="30" cy="22" r="2.4" fill="currentColor" />
              <circle cx="10" cy="38" r="2.4" fill="currentColor" />
              <circle cx="30" cy="38" r="2.4" fill="currentColor" />
            </svg>
          </span>
          <div className="v12-agent-text">
            <span className="v12-agent-tag">01 · Agent</span>
            <span className="v12-agent-name">HELIX</span>
            <span className="v12-agent-role">Smart form + smart routing</span>
          </div>
        </div>
        <p className="v12-agent-body">
          Watches every form session. Reshapes fields on partial answers. Then routes the qualified
          buyer to the closer most likely to close them.
        </p>
        <div className="v12-agent-chips">
          <span className="v12-agent-chip">Form reshape · live</span>
          <span className="v12-agent-chip">Multi-hop routing</span>
          <span className="v12-agent-chip">A/B per branch</span>
        </div>
      </article>

      {/* ORACLE */}
      <article className="v12-agent v12-agent-2">
        <div className="v12-agent-row">
          <span className="v12-glyph" aria-hidden>
            <svg width="64" height="64" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2.4" />
              <circle cx="20" cy="20" r="7" fill="currentColor" opacity="0.25" />
              <circle cx="20" cy="20" r="3" fill="currentColor" />
              <path
                d="M20 4 L20 14 M20 26 L20 36 M4 20 L14 20 M26 20 L36 20"
                stroke="currentColor"
                strokeWidth="2.4"
              />
            </svg>
          </span>
          <div className="v12-agent-text">
            <span className="v12-agent-tag">02 · Agent</span>
            <span className="v12-agent-name">ORACLE</span>
            <span className="v12-agent-role">Pre-qualification agents</span>
          </div>
        </div>
        <p className="v12-agent-body">
          3 financial signals in parallel — soft-pull credit, income capacity, fundability tier —
          all FCRA / GLBA-compliant, all in under 3 seconds.
        </p>
        <div className="v12-agent-chips">
          <span className="v12-agent-chip">Credit · FCRA soft pull</span>
          <span className="v12-agent-chip">Income · DTI</span>
          <span className="v12-agent-chip">Tier · A / B / C / D</span>
        </div>
      </article>

      {/* NEXUS */}
      <article className="v12-agent v12-agent-3">
        <div className="v12-agent-row">
          <span className="v12-glyph" aria-hidden>
            <svg width="64" height="64" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="3" fill="currentColor" />
              <g stroke="currentColor" strokeWidth="2">
                <line x1="20" y1="20" x2="32" y2="20" />
                <line x1="20" y1="20" x2="8" y2="20" />
                <line x1="20" y1="20" x2="26" y2="30.4" />
                <line x1="20" y1="20" x2="14" y2="30.4" />
                <line x1="20" y1="20" x2="26" y2="9.6" />
                <line x1="20" y1="20" x2="14" y2="9.6" />
              </g>
              <circle cx="32" cy="20" r="2.4" fill="currentColor" opacity="0.7" />
              <circle cx="8" cy="20" r="2.4" fill="currentColor" opacity="0.7" />
              <circle cx="26" cy="30.4" r="2.4" fill="currentColor" opacity="0.7" />
              <circle cx="14" cy="30.4" r="2.4" fill="currentColor" opacity="0.7" />
              <circle cx="26" cy="9.6" r="2.4" fill="currentColor" opacity="0.7" />
              <circle cx="14" cy="9.6" r="2.4" fill="currentColor" opacity="0.7" />
            </svg>
          </span>
          <div className="v12-agent-text">
            <span className="v12-agent-tag">03 · Agent</span>
            <span className="v12-agent-name">NEXUS</span>
            <span className="v12-agent-role">Lender marketplace</span>
          </div>
        </div>
        <p className="v12-agent-body">
          Fires the qualified buyer at every finance rail in parallel — consumer-direct,
          merchant-direct, BNPL. Cheapest pre-approved offer wins.
        </p>
        <div className="v12-agent-chips">
          <span className="v12-agent-chip">Consumer-direct</span>
          <span className="v12-agent-chip">Merchant-direct</span>
          <span className="v12-agent-chip">BNPL</span>
        </div>
      </article>

      {/* orchestration shot */}
      <div className="v12-orch">
        <div className="v12-orch-row">
          <div className="v12-orch-cell">
            <span className="v12-orch-glyph">
              <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                <circle cx="10" cy="6" r="2" fill="currentColor" />
                <circle cx="30" cy="6" r="2" fill="currentColor" />
                <circle cx="10" cy="22" r="2" fill="currentColor" />
                <circle cx="30" cy="22" r="2" fill="currentColor" />
                <circle cx="10" cy="38" r="2" fill="currentColor" />
                <circle cx="30" cy="38" r="2" fill="currentColor" />
                <path
                  d="M10 6 Q20 14 30 6 Q20 14 10 22 Q20 30 30 22 Q20 30 10 38"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </span>
            <div className="v12-orch-name">HELIX</div>
            <div className="v12-orch-role">
              Smart form +<br />
              smart routing
            </div>
          </div>
          <div className="v12-orch-cell">
            <span className="v12-orch-glyph">
              <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2" />
                <circle cx="20" cy="20" r="3" fill="currentColor" />
              </svg>
            </span>
            <div className="v12-orch-name">ORACLE</div>
            <div className="v12-orch-role">
              Pre-qualification
              <br />
              agents
            </div>
          </div>
          <div className="v12-orch-cell">
            <span className="v12-orch-glyph">
              <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="3" fill="currentColor" />
                <g stroke="currentColor" strokeWidth="1.6">
                  <line x1="20" y1="20" x2="32" y2="20" />
                  <line x1="20" y1="20" x2="8" y2="20" />
                  <line x1="20" y1="20" x2="26" y2="30" />
                  <line x1="20" y1="20" x2="14" y2="30" />
                </g>
              </svg>
            </span>
            <div className="v12-orch-name">NEXUS</div>
            <div className="v12-orch-role">
              Lender
              <br />
              marketplace
            </div>
          </div>
        </div>

        <div className="v12-orch-edges">
          <svg className="v12-orch-svg" viewBox="0 0 980 60" preserveAspectRatio="none">
            <path d="M 160 0 C 160 30, 490 30, 490 30" className="v12-orch-edge" />
            <path d="M 490 30 C 490 30, 820 30, 820 0" className="v12-orch-edge" />
            <path d="M 490 30 L 490 60" className="v12-orch-edge" />
          </svg>
        </div>

        <div className="v12-orch-outcome">
          <div className="v12-orch-outcome-tag">Funded · merchant-direct · 48 hr</div>
          <div className="v12-orch-outcome-h">$14,200 · Tier A · same visit</div>
        </div>
      </div>

      <div className="v12-stamp">
        Three agents.
        <br />
        <em>One MedPay.</em>
      </div>

      <Cta label="See it run on your funnel" ctaDelay={15.0} disclDelay={15.4} />
    </VideoStage>
  );
}
