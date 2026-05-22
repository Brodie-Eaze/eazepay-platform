/**
 * Video ad V2 — "I'll think about it → I'll do it"  ·  15s  ·  1080×1920
 *
 * Rebuild — each element gets its own opacity animation.
 *
 *    0.0–0.8   stage in
 *    0.8–4.0   HOOK headline "Every consult ends differently."
 *    4.0–5.0   hook fades, transition pause
 *    4.5–7.5   BUBBLE 1 ("Let me think about it.") slides from left
 *    7.0–8.5   middle caption "Same patient. Different ending."
 *    8.0–11.5  BUBBLE 2 ("$295/mo? Let's book.") slides from right + glow
 *   11.0–13.0  three approval rails check in below
 *   13.0–14.0  "Same chair. Same hour. Funded." stamp
 *   14.0–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';

export default function MedPayVideoV2(): JSX.Element {
  return (
    <VideoStage
      css={`
        .v2-mark {
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
        .v2-mark-sq {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          box-shadow: 0 12px 28px -8px rgba(34, 184, 160, 0.55);
        }
        .v2-mark-slash {
          color: rgba(255, 255, 255, 0.4);
          margin: 0 2px;
          font-weight: 300;
        }
        .v2-mark-l {
          color: ${TEAL_2};
        }
        .v2-tag {
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

        /* HOOK headline */
        .v2-hook {
          position: absolute;
          top: 600px;
          left: 64px;
          right: 64px;
          text-align: center;
          font-size: 110px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.02;
          color: #fff;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.3);
          opacity: 0;
          filter: blur(20px);
          animation:
            vs-num-in 0.7s 0.8s forwards,
            vs-num-out 0.5s 3.8s forwards;
        }
        @keyframes vs-num-in {
          0% {
            opacity: 0;
            filter: blur(20px);
            transform: scale(1.06);
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
        .v2-hook em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* speech bubble 1 — "Let me think about it." */
        .v2-bubble-1 {
          position: absolute;
          top: 500px;
          left: 64px;
          width: 840px;
          padding: 38px 46px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: rgba(255, 255, 255, 0.72);
          border-radius: 44px 44px 44px 8px;
          font-size: 60px;
          font-weight: 700;
          letter-spacing: -0.022em;
          line-height: 1.22;
          opacity: 0;
          animation:
            vs-bubble-l 0.6s 4.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards,
            vs-bubble-fade 0.6s 7s forwards;
        }
        @keyframes vs-bubble-l {
          0% {
            opacity: 0;
            transform: translateX(-100px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes vs-bubble-fade {
          0% {
            opacity: 1;
            filter: blur(0);
          }
          100% {
            opacity: 0.2;
            filter: blur(8px);
          }
        }
        .v2-bubble-tag-1 {
          display: inline-block;
          margin-bottom: 16px;
          padding: 8px 16px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 16px;
          letter-spacing: 0.2em;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.68);
          border-radius: 999px;
        }

        /* middle caption */
        .v2-mid {
          position: absolute;
          top: 880px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 76px;
          font-weight: 800;
          letter-spacing: -0.035em;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.4);
          opacity: 0;
          animation:
            vs-num-in 0.6s 7s forwards,
            vs-num-out 0.5s 8.4s forwards;
        }
        .v2-mid em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* speech bubble 2 — "$295/mo? Let's book." */
        .v2-bubble-2 {
          position: absolute;
          top: 1000px;
          right: 64px;
          width: 840px;
          padding: 38px 46px;
          background: linear-gradient(135deg, rgba(34, 184, 160, 0.55), rgba(14, 124, 102, 0.62));
          border: 1px solid rgba(34, 184, 160, 0.8);
          color: #fff;
          border-radius: 44px 44px 8px 44px;
          font-size: 60px;
          font-weight: 800;
          letter-spacing: -0.022em;
          line-height: 1.22;
          box-shadow: 0 40px 80px -16px rgba(34, 184, 160, 0.55);
          opacity: 0;
          animation: vs-bubble-r 0.6s 8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        @keyframes vs-bubble-r {
          0% {
            opacity: 0;
            transform: translateX(100px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .v2-bubble-tag-2 {
          display: inline-block;
          margin-bottom: 16px;
          padding: 8px 16px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 16px;
          letter-spacing: 0.2em;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
          border-radius: 999px;
        }

        /* 3 rails */
        .v2-rails {
          position: absolute;
          top: 1400px;
          left: 64px;
          right: 64px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .v2-rail {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 24px;
          background: rgba(34, 184, 160, 0.14);
          border: 1px solid rgba(34, 184, 160, 0.4);
          border-radius: 14px;
          font-size: 26px;
          opacity: 0;
          backdrop-filter: blur(14px);
        }
        .v2-rail-1 {
          animation: vs-rail-in 0.4s 11s forwards;
        }
        .v2-rail-2 {
          animation: vs-rail-in 0.4s 11.4s forwards;
        }
        .v2-rail-3 {
          animation: vs-rail-in 0.4s 11.8s forwards;
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
        .v2-rail-l {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          color: #fff;
          font-weight: 700;
        }
        .v2-rail-c {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          background: rgba(34, 184, 160, 0.35);
          color: ${TEAL_2};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }
        .v2-rail-amt {
          color: ${TEAL_2};
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          font-size: 30px;
        }

        /* stamp */
        .v2-stamp {
          position: absolute;
          top: 1640px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 60px;
          font-weight: 800;
          letter-spacing: -0.028em;
          color: #fff;
          opacity: 0;
          animation: vs-stamp-in 0.55s 13s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
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
        .v2-stamp em {
          font-style: normal;
          color: ${TEAL_2};
        }

        .v2-cta {
          position: absolute;
          bottom: 200px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.55s 13.8s forwards;
        }
        .v2-cta-btn {
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
          animation: vs-pulse 1.8s 14.2s infinite;
        }
        .v2-discl {
          position: absolute;
          bottom: 56px;
          left: 56px;
          right: 56px;
          font-size: 15px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.55s 14.2s forwards;
        }
      `}
    >
      <div className="v2-mark">
        <span className="v2-mark-sq" />
        <span>
          <span className="v2-mark-l">Med</span>
          <span className="v2-mark-slash">/</span>
          <span>Pay</span>
        </span>
      </div>
      <div className="v2-tag">Treatment coordinators</div>

      <div className="v2-hook">
        Every consult
        <br />
        ends <em>differently.</em>
      </div>

      <div className="v2-bubble-1">
        <div className="v2-bubble-tag-1">Before MedPay</div>
        &ldquo;Let me think about it.&rdquo;
      </div>

      <div className="v2-mid">
        Same patient. <em>Different ending.</em>
      </div>

      <div className="v2-bubble-2">
        <div className="v2-bubble-tag-2">With MedPay · 10s pre-qual</div>
        &ldquo;$295/mo? Let&apos;s book.&rdquo;
      </div>

      <div className="v2-rails">
        <div className="v2-rail v2-rail-1">
          <span className="v2-rail-l">
            <span className="v2-rail-c">✓</span> Consumer-direct
          </span>
          <span className="v2-rail-amt">$14,200</span>
        </div>
        <div className="v2-rail v2-rail-2">
          <span className="v2-rail-l">
            <span className="v2-rail-c">✓</span> Merchant-direct
          </span>
          <span className="v2-rail-amt">$18,500</span>
        </div>
        <div className="v2-rail v2-rail-3">
          <span className="v2-rail-l">
            <span className="v2-rail-c">✓</span> BNPL
          </span>
          <span className="v2-rail-amt">$5,000</span>
        </div>
      </div>

      <div className="v2-stamp">
        Same chair. Same hour. <em>Funded.</em>
      </div>

      <div className="v2-cta">
        <div className="v2-cta-btn">Book a 15-min demo →</div>
      </div>

      <div className="v2-discl">
        EazePay, LLC · NMLS #2456701 · Loans subject to lender approval. Soft-pull pre-qualification
        has zero impact on credit score. Not a guarantee of approval.
      </div>
    </VideoStage>
  );
}
