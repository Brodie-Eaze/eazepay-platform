/**
 * Video ad V13 — "Pre-call up front. Finance out back. One MedPay."  ·  17s  ·  1080×1920
 *
 * The two-halves story. Top half = FRONT (pre-call: HELIX smart form +
 * ORACLE pre-qual). Bottom half = BACK (finance: NEXUS 3 rails + wire).
 * Mid-video, the two halves SNAP together with a connecting bridge.
 *
 *  0.0–1.0   stage in
 *  1.0–2.5   "Pre-call up front. Finance out back." headline lands
 *  2.5–6.0   TOP half (FRONT) reveals: HELIX form + ORACLE 3 agents
 *  6.0–9.5   BOTTOM half (BACK) reveals: NEXUS 3 finance rails + wire
 *  9.5–11.5  bridge line + "Same system. One handoff." text
 * 11.5–13.5  final result card: full pre-qual + finance payload
 * 13.5–15.0  "That's MedPay." stamp
 * 15.0–17.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV13(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        .v13-h {
          position: absolute;
          top: 180px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 72px;
          font-weight: 800;
          letter-spacing: -0.034em;
          line-height: 1.04;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.3);
          opacity: 0;
          animation:
            vs-in-up 0.7s 1s forwards,
            vs-fade-out 0.4s 13.4s forwards;
        }
        @keyframes vs-fade-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .v13-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* TWO HALVES — front (top) / back (bottom) */
        .v13-half {
          position: absolute;
          left: 64px;
          right: 64px;
          padding: 32px;
          border-radius: 28px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.18), transparent 65%),
            rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(34, 184, 160, 0.5);
          backdrop-filter: blur(14px);
          box-shadow: 0 40px 80px -20px rgba(34, 184, 160, 0.4);
          opacity: 0;
        }
        .v13-front {
          top: 380px;
          animation:
            vs-card-in 0.7s 2.5s forwards,
            v13-shrink-top 0.6s 11.4s forwards;
        }
        .v13-back {
          top: 920px;
          animation:
            vs-card-in 0.7s 6s forwards,
            v13-shrink-bot 0.6s 11.4s forwards;
        }
        @keyframes vs-card-in {
          0% {
            opacity: 0;
            transform: translateY(60px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes v13-shrink-top {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.94) translateY(-40px);
          }
        }
        @keyframes v13-shrink-bot {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.94) translateY(40px);
          }
        }
        .v13-half-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 16px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v13-half-h {
          margin-top: 8px;
          font-size: 44px;
          font-weight: 800;
          letter-spacing: -0.024em;
          line-height: 1.04;
          color: #fff;
        }
        .v13-half-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* FRONT — HELIX form + ORACLE results */
        .v13-front-body {
          margin-top: 22px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .v13-mini {
          padding: 16px 18px;
          background: rgba(34, 184, 160, 0.08);
          border: 1px solid rgba(34, 184, 160, 0.3);
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 16px;
          opacity: 0;
        }
        .v13-front-body .v13-mini:nth-child(1) {
          animation: vs-in-up 0.4s 3s forwards;
        }
        .v13-front-body .v13-mini:nth-child(2) {
          animation: vs-in-up 0.4s 3.6s forwards;
        }
        .v13-front-body .v13-mini:nth-child(3) {
          animation: vs-in-up 0.4s 4.2s forwards;
        }
        .v13-mini-glyph {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
        }
        .v13-mini-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .v13-mini-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.55);
          text-transform: uppercase;
        }
        .v13-mini-v {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.014em;
          font-variant-numeric: tabular-nums;
        }
        .v13-mini-r {
          margin-left: auto;
          color: ${TEAL_2};
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        /* ORACLE composite tier badge */
        .v13-tier {
          margin-top: 14px;
          padding: 14px 18px;
          background: linear-gradient(135deg, rgba(34, 184, 160, 0.42), rgba(14, 124, 102, 0.55));
          border: 1px solid rgba(34, 184, 160, 0.75);
          border-radius: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #fff;
          opacity: 0;
          animation: vs-in-up 0.4s 4.8s forwards;
        }
        .v13-tier-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          text-transform: uppercase;
        }
        .v13-tier-v {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.024em;
        }

        /* BACK — NEXUS 3 rails + wire stamp */
        .v13-back-body {
          margin-top: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .v13-back-body .v13-mini:nth-child(1) {
          animation: vs-in-up 0.4s 6.5s forwards;
        }
        .v13-back-body .v13-mini:nth-child(2) {
          animation: vs-in-up 0.4s 7.1s forwards;
        }
        .v13-back-body .v13-mini:nth-child(3) {
          animation: vs-in-up 0.4s 7.7s forwards;
        }
        .v13-wire {
          margin-top: 14px;
          padding: 14px 18px;
          background: linear-gradient(135deg, rgba(34, 184, 160, 0.42), rgba(14, 124, 102, 0.55));
          border: 1px solid rgba(34, 184, 160, 0.75);
          border-radius: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #fff;
          opacity: 0;
          animation: vs-in-up 0.4s 8.5s forwards;
        }
        .v13-wire-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          text-transform: uppercase;
        }
        .v13-wire-v {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.018em;
        }

        /* connector bridge between halves */
        .v13-bridge {
          position: absolute;
          top: 820px;
          left: 0;
          right: 0;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          animation:
            vs-in-up 0.5s 9.5s forwards,
            vs-fade-out 0.5s 11s forwards;
        }
        .v13-bridge-pill {
          padding: 14px 22px;
          background: linear-gradient(135deg, rgba(34, 184, 160, 0.42), rgba(14, 124, 102, 0.55));
          border: 1px solid rgba(34, 184, 160, 0.75);
          border-radius: 999px;
          color: #fff;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          letter-spacing: 0.18em;
          font-weight: 700;
          text-transform: uppercase;
        }

        /* final consolidated payload card */
        .v13-payload {
          position: absolute;
          top: 420px;
          left: 64px;
          right: 64px;
          padding: 40px;
          border-radius: 32px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.3), transparent 65%),
            rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(34, 184, 160, 0.7);
          backdrop-filter: blur(18px);
          box-shadow: 0 60px 120px -30px rgba(0, 0, 0, 0.7);
          opacity: 0;
          animation: vs-card-in 0.7s 12s forwards;
        }
        .v13-payload-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 16px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v13-payload-h {
          margin-top: 10px;
          font-size: 56px;
          font-weight: 800;
          letter-spacing: -0.026em;
          line-height: 1;
          color: #fff;
        }
        .v13-payload-amt {
          margin-top: 16px;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: ${TEAL_2};
          font-variant-numeric: tabular-nums;
        }
        .v13-payload-meta {
          margin-top: 16px;
          font-size: 22px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.78);
        }
        .v13-payload-row {
          margin-top: 22px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
        }
        .v13-payload-cell {
          padding: 14px 12px;
          background: rgba(34, 184, 160, 0.18);
          border: 1px solid rgba(34, 184, 160, 0.4);
          border-radius: 12px;
          text-align: center;
        }
        .v13-payload-cell-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.16em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v13-payload-cell-v {
          margin-top: 4px;
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.014em;
          font-variant-numeric: tabular-nums;
        }

        /* final stamp */
        .v13-stamp {
          position: absolute;
          top: 1340px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 84px;
          font-weight: 800;
          letter-spacing: -0.04em;
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
        .v13-stamp em {
          font-style: normal;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>Pre-call + finance</Tag>

      <h1 className="v13-h">
        Pre-call up <em>front.</em>
        <br />
        Finance out <em>back.</em>
      </h1>

      {/* FRONT half */}
      <article className="v13-half v13-front">
        <div className="v13-half-tag">Front · pre-call</div>
        <div className="v13-half-h">
          HELIX form → <em>ORACLE pre-qual</em>
        </div>
        <div className="v13-front-body">
          <div className="v13-mini">
            <span className="v13-mini-glyph">H</span>
            <div className="v13-mini-text">
              <span className="v13-mini-k">HELIX · smart form</span>
              <span className="v13-mini-v">4 fields · 8.7s</span>
            </div>
            <span className="v13-mini-r">submit ✓</span>
          </div>
          <div className="v13-mini">
            <span className="v13-mini-glyph">O</span>
            <div className="v13-mini-text">
              <span className="v13-mini-k">ORACLE · 3 signals</span>
              <span className="v13-mini-v">Credit 724 · Income $98k · DTI 22%</span>
            </div>
          </div>
          <div className="v13-mini">
            <span className="v13-mini-glyph">H</span>
            <div className="v13-mini-text">
              <span className="v13-mini-k">HELIX · smart routing</span>
              <span className="v13-mini-v">Tier A → senior closer</span>
            </div>
            <span className="v13-mini-r">Thu 2:00 PM</span>
          </div>
        </div>
        <div className="v13-tier">
          <span className="v13-tier-k">Composite tier</span>
          <span className="v13-tier-v">Tier A · all 3 rails open</span>
        </div>
      </article>

      {/* BACK half */}
      <article className="v13-half v13-back">
        <div className="v13-half-tag">Back · finance</div>
        <div className="v13-half-h">
          NEXUS marketplace → <em>wire merchant-direct</em>
        </div>
        <div className="v13-back-body">
          <div className="v13-mini">
            <span className="v13-mini-glyph">N</span>
            <div className="v13-mini-text">
              <span className="v13-mini-k">Consumer-direct</span>
              <span className="v13-mini-v">Pre-approved</span>
            </div>
            <span className="v13-mini-r">$14,200</span>
          </div>
          <div className="v13-mini">
            <span className="v13-mini-glyph">N</span>
            <div className="v13-mini-text">
              <span className="v13-mini-k">Merchant-direct</span>
              <span className="v13-mini-v">Pre-approved</span>
            </div>
            <span className="v13-mini-r">$18,500</span>
          </div>
          <div className="v13-mini">
            <span className="v13-mini-glyph">N</span>
            <div className="v13-mini-text">
              <span className="v13-mini-k">BNPL</span>
              <span className="v13-mini-v">Pre-approved</span>
            </div>
            <span className="v13-mini-r">$5,000</span>
          </div>
        </div>
        <div className="v13-wire">
          <span className="v13-wire-k">Wire · merchant-direct · 48 hr</span>
          <span className="v13-wire-v">$14,200</span>
        </div>
      </article>

      {/* bridge between halves */}
      <div className="v13-bridge">
        <span className="v13-bridge-pill">↑ + ↓ · one handoff</span>
      </div>

      {/* consolidated payload */}
      <article className="v13-payload">
        <div className="v13-payload-tag">Pre-call + finance · one payload</div>
        <div className="v13-payload-h">Jordan M. · Tier A</div>
        <div className="v13-payload-amt">$14,200 funded</div>
        <div className="v13-payload-meta">Booked Thu 2:00 PM · wire scheduled · 48 hr</div>
        <div className="v13-payload-row">
          <div className="v13-payload-cell">
            <div className="v13-payload-cell-k">Form</div>
            <div className="v13-payload-cell-v">8.7s</div>
          </div>
          <div className="v13-payload-cell">
            <div className="v13-payload-cell-k">Rails approved</div>
            <div className="v13-payload-cell-v">3 / 3</div>
          </div>
          <div className="v13-payload-cell">
            <div className="v13-payload-cell-k">Time to wire</div>
            <div className="v13-payload-cell-v">48 hr</div>
          </div>
        </div>
      </article>

      <div className="v13-stamp">
        That&apos;s <em>MedPay.</em>
      </div>

      <Cta label="See it run on your funnel" ctaDelay={15.0} disclDelay={15.4} />
    </VideoStage>
  );
}
