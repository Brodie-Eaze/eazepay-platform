/**
 * Video ad V1 — "$1.4M Walks Out"  ·  15s  ·  1080×1920 (9:16)
 *
 * Rebuild — each animated element gets its OWN opacity animation
 * so visibility doesn't depend on a fragile parent-opacity chain.
 * Gradient text only on inline <em> spans (which we've verified render
 * reliably in Chromium recording). Big numbers use solid white +
 * teal text-shadow for the glow.
 *
 * Timeline:
 *    0.0–0.8   stage in: brand mark + tag
 *    0.8–1.6   "lost per year" eyebrow lands
 *    1.6–2.4   $1,400,000 hero number blurs in
 *    2.4–4.5   sub-line + accent underline reveal
 *    4.5–5.4   number + sub fade out (blur out)
 *    5.4–6.4   "What if it didn't?" pull-quote
 *    6.4–7.0   pull-quote fades
 *    7.0–10.5  recovered-case card slides up + signal cells reveal
 *   10.5–12.5  three approval rails check in one by one
 *   12.5–14.0  "Funded · same visit" stamp slams in
 *   14.0–15.0  CTA + compliance footer
 */
import { VideoStage, TEAL_2 } from '../_stage';

export default function MedPayVideoV1(): JSX.Element {
  return (
    <VideoStage
      css={`
        /* ── brand chrome (always visible after fade-in) ── */
        .v1-mark {
          position: absolute;
          top: 56px;
          left: 56px;
          display: inline-flex;
          align-items: center;
          gap: 16px;
          font-size: 36px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
          opacity: 0;
          animation: vs-in-down 0.6s 0.2s forwards;
        }
        .v1-mark-sq {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          box-shadow: 0 12px 28px -8px rgba(34, 184, 160, 0.55);
        }
        .v1-mark-slash {
          color: rgba(255, 255, 255, 0.4);
          margin: 0 2px;
          font-weight: 300;
        }
        .v1-mark-l {
          color: ${TEAL_2};
        }
        .v1-tag {
          position: absolute;
          top: 56px;
          right: 56px;
          padding: 10px 16px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          background: rgba(34, 184, 160, 0.14);
          border: 1px solid rgba(34, 184, 160, 0.34);
          border-radius: 999px;
          opacity: 0;
          animation: vs-in-down 0.6s 0.4s forwards;
        }

        /* ── Act 1 (0.8 → 5.4s): the loss ── */
        .v1-eyebrow {
          position: absolute;
          top: 360px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 26px;
          letter-spacing: 0.34em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation:
            vs-in-up 0.6s 0.9s forwards,
            vs-fade-out 0.5s 4.8s forwards;
        }

        .v1-hero-num {
          position: absolute;
          top: 470px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 200px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
          color: #fff;
          font-variant-numeric: tabular-nums;
          text-shadow:
            0 0 60px rgba(34, 184, 160, 0.55),
            0 0 120px rgba(34, 184, 160, 0.3);
          opacity: 0;
          filter: blur(20px);
          animation:
            vs-num-in 0.9s 1.6s cubic-bezier(0.22, 0.61, 0.36, 1) forwards,
            vs-num-out 0.6s 4.8s forwards;
        }
        @keyframes vs-num-in {
          0% {
            opacity: 0;
            filter: blur(20px);
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
          }
        }
        @keyframes vs-num-out {
          0% {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
          }
          100% {
            opacity: 0;
            filter: blur(16px);
            transform: scale(0.97);
          }
        }

        .v1-hero-sub {
          position: absolute;
          top: 770px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 44px;
          font-weight: 700;
          letter-spacing: -0.022em;
          line-height: 1.18;
          color: rgba(255, 255, 255, 0.92);
          max-width: 900px;
          margin: 0 auto;
          opacity: 0;
          animation:
            vs-in-up 0.6s 2.4s forwards,
            vs-fade-out 0.5s 4.8s forwards;
        }
        .v1-hero-sub em {
          font-style: normal;
          color: ${TEAL_2};
          font-weight: 800;
        }
        @keyframes vs-fade-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        /* ── bridge (5.4 → 7.0s): pull-quote ── */
        .v1-bridge {
          position: absolute;
          top: 760px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #fff;
          opacity: 0;
          filter: blur(16px);
          animation:
            vs-num-in 0.7s 5.4s forwards,
            vs-num-out 0.5s 6.8s forwards;
        }
        .v1-bridge em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ── Act 2 (7.0 → 14s): the recovered case ── */
        .v1-card {
          position: absolute;
          top: 320px;
          left: 80px;
          right: 80px;
          padding: 44px;
          border-radius: 36px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.3), transparent 65%),
            rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(34, 184, 160, 0.5);
          backdrop-filter: blur(18px);
          box-shadow: 0 60px 120px -30px rgba(0, 0, 0, 0.7);
          opacity: 0;
          animation: vs-card-in 0.7s 7s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        @keyframes vs-card-in {
          0% {
            opacity: 0;
            transform: translateY(80px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .v1-card-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v1-card-name {
          margin-top: 14px;
          font-size: 76px;
          font-weight: 800;
          letter-spacing: -0.024em;
          color: #fff;
        }
        .v1-card-tier {
          margin-top: 8px;
          display: inline-block;
          padding: 7px 14px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 15px;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: ${TEAL_2};
          background: rgba(34, 184, 160, 0.2);
          border-radius: 8px;
        }
        .v1-sig-row {
          margin-top: 30px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 3px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          overflow: hidden;
          opacity: 0;
          animation: vs-in-up 0.5s 7.8s forwards;
        }
        .v1-sig {
          padding: 22px 8px;
          background: rgba(10, 20, 18, 0.95);
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: center;
        }
        .v1-sig-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.16em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
        }
        .v1-sig-v {
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -0.022em;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }

        .v1-rails {
          margin-top: 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .v1-rail {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 22px 28px;
          background: rgba(34, 184, 160, 0.14);
          border: 1px solid rgba(34, 184, 160, 0.4);
          border-radius: 16px;
          font-size: 28px;
          opacity: 0;
        }
        .v1-rail-1 {
          animation: vs-rail-in 0.45s 9s forwards;
        }
        .v1-rail-2 {
          animation: vs-rail-in 0.45s 9.5s forwards;
        }
        .v1-rail-3 {
          animation: vs-rail-in 0.45s 10s forwards;
        }
        @keyframes vs-rail-in {
          0% {
            opacity: 0;
            transform: translateX(-30px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .v1-rail-l {
          display: inline-flex;
          align-items: center;
          gap: 16px;
          color: #fff;
          font-weight: 700;
        }
        .v1-rail-check {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          background: rgba(34, 184, 160, 0.35);
          color: ${TEAL_2};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 22px;
        }
        .v1-rail-amt {
          color: ${TEAL_2};
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          font-size: 32px;
        }

        /* ── Act 3 (12.5 → 14s): stamp ── */
        .v1-stamp {
          position: absolute;
          top: 1380px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 110px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #fff;
          opacity: 0;
          animation: vs-stamp-in 0.55s 11s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        @keyframes vs-stamp-in {
          0% {
            opacity: 0;
            transform: scale(1.35);
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
        .v1-stamp em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ── CTA + compliance ── */
        .v1-cta {
          position: absolute;
          bottom: 200px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.55s 12s forwards;
        }
        .v1-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 28px 50px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          color: #fff;
          border-radius: 999px;
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -0.01em;
          box-shadow: 0 28px 60px -16px rgba(34, 184, 160, 0.6);
          animation: vs-pulse 1.8s 13s infinite;
        }
        .v1-discl {
          position: absolute;
          bottom: 56px;
          left: 56px;
          right: 56px;
          font-size: 15px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.55s 12.5s forwards;
        }
      `}
    >
      <div className="v1-mark">
        <span className="v1-mark-sq" />
        <span>
          <span className="v1-mark-l">Med</span>
          <span className="v1-mark-slash">/</span>
          <span>Pay</span>
        </span>
      </div>
      <div className="v1-tag">For practice owners</div>

      <div className="v1-eyebrow">Lost per year</div>
      <div className="v1-hero-num">$1,400,000</div>
      <div className="v1-hero-sub">
        walks out of your practice <em>unfunded.</em>
      </div>

      <div className="v1-bridge">
        What if it <em>didn&apos;t</em>?
      </div>

      <div className="v1-card">
        <div className="v1-card-tag">Recovered case · Tier A</div>
        <div className="v1-card-name">Jordan M.</div>
        <span className="v1-card-tier">Tier · verified</span>
        <div className="v1-sig-row">
          <div className="v1-sig">
            <span className="v1-sig-k">Credit</span>
            <span className="v1-sig-v">724</span>
          </div>
          <div className="v1-sig">
            <span className="v1-sig-k">Available</span>
            <span className="v1-sig-v">$12.4k</span>
          </div>
          <div className="v1-sig">
            <span className="v1-sig-k">Income</span>
            <span className="v1-sig-v">$98k</span>
          </div>
          <div className="v1-sig">
            <span className="v1-sig-k">DTI</span>
            <span className="v1-sig-v">22%</span>
          </div>
        </div>
        <div className="v1-rails">
          <div className="v1-rail v1-rail-1">
            <span className="v1-rail-l">
              <span className="v1-rail-check">✓</span> Consumer-direct
            </span>
            <span className="v1-rail-amt">$14,200</span>
          </div>
          <div className="v1-rail v1-rail-2">
            <span className="v1-rail-l">
              <span className="v1-rail-check">✓</span> Merchant-direct
            </span>
            <span className="v1-rail-amt">$18,500</span>
          </div>
          <div className="v1-rail v1-rail-3">
            <span className="v1-rail-l">
              <span className="v1-rail-check">✓</span> BNPL
            </span>
            <span className="v1-rail-amt">$5,000</span>
          </div>
        </div>
      </div>

      <div className="v1-stamp">
        Funded · <em>same visit</em>
      </div>

      <div className="v1-cta">
        <div className="v1-cta-btn">See the math →</div>
      </div>

      <div className="v1-discl">
        EazePay, LLC · NMLS #2456701 · Loans subject to lender approval. Soft-pull pre-qualification
        has zero impact on credit score.
      </div>
    </VideoStage>
  );
}
