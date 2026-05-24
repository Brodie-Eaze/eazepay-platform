/**
 * Video ad V3 — "10 Seconds. Funded."  ·  15s  ·  1080×1920
 *
 * Rebuild — each element gets its own opacity animation.
 *
 *    0.0–0.8   stage in
 *    0.8–2.5   timer "00:00" lands huge, with eyebrow
 *    2.5–8.5   tablet fills its 4 fields, mini-timer ticks 0:01→0:08
 *    8.5–9.5   tablet fades; "Pre-qualified" headline lands
 *    9.5–11.5  3 approval rails check in
 *   11.5–13.5  "Funded · 8.7s" stamp slams
 *   13.5–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';

export default function MedPayVideoV3(): JSX.Element {
  return (
    <VideoStage
      css={`
        .v3-mark {
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
        .v3-mark-sq {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          box-shadow: 0 12px 28px -8px rgba(34, 184, 160, 0.55);
        }
        .v3-mark-slash {
          color: rgba(255, 255, 255, 0.4);
          margin: 0 2px;
          font-weight: 300;
        }
        .v3-mark-l {
          color: ${TEAL_2};
        }
        .v3-tag {
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

        /* HUGE timer eyebrow */
        .v3-timer-label {
          position: absolute;
          top: 230px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 28px;
          letter-spacing: 0.34em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation:
            vs-in-up 0.6s 0.8s forwards,
            vs-fade-out 0.5s 8.4s forwards;
        }
        @keyframes vs-fade-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        /* HUGE timer numbers */
        .v3-timer {
          position: absolute;
          top: 310px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 360px;
          font-weight: 800;
          letter-spacing: -0.05em;
          color: #fff;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 70px rgba(34, 184, 160, 0.5);
          opacity: 0;
          animation:
            vs-num-in 0.7s 1s forwards,
            vs-num-out 0.5s 8.4s forwards;
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

        /* timer ticks — only one visible at a time via crossfade */
        .v3-timer-tick {
          position: absolute;
          left: 0;
          right: 0;
          opacity: 0;
        }
        .v3-timer-tick.t0 {
          animation:
            vs-tick-show 0.6s 1s forwards,
            vs-tick-hide 0.25s 2.6s forwards;
        }
        .v3-timer-tick.t1 {
          animation:
            vs-tick-show 0.25s 2.85s forwards,
            vs-tick-hide 0.25s 3.55s forwards;
        }
        .v3-timer-tick.t2 {
          animation:
            vs-tick-show 0.25s 3.55s forwards,
            vs-tick-hide 0.25s 4.25s forwards;
        }
        .v3-timer-tick.t3 {
          animation:
            vs-tick-show 0.25s 4.25s forwards,
            vs-tick-hide 0.25s 4.95s forwards;
        }
        .v3-timer-tick.t4 {
          animation:
            vs-tick-show 0.25s 4.95s forwards,
            vs-tick-hide 0.25s 5.65s forwards;
        }
        .v3-timer-tick.t5 {
          animation:
            vs-tick-show 0.25s 5.65s forwards,
            vs-tick-hide 0.25s 6.35s forwards;
        }
        .v3-timer-tick.t6 {
          animation:
            vs-tick-show 0.25s 6.35s forwards,
            vs-tick-hide 0.25s 7.05s forwards;
        }
        .v3-timer-tick.t7 {
          animation:
            vs-tick-show 0.25s 7.05s forwards,
            vs-tick-hide 0.25s 7.75s forwards;
        }
        .v3-timer-tick.t8 {
          animation: vs-tick-show 0.25s 7.75s forwards;
        }
        @keyframes vs-tick-show {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes vs-tick-hide {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-20px);
          }
        }

        /* tablet — appears at 2.5s */
        .v3-tablet {
          position: absolute;
          top: 880px;
          left: 80px;
          right: 80px;
          padding: 24px;
          border-radius: 36px;
          background: linear-gradient(135deg, #0f2724, #062120);
          box-shadow: 0 60px 120px -30px rgba(0, 0, 0, 0.7);
          opacity: 0;
          animation:
            vs-card-in 0.6s 2.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards,
            vs-fade-out 0.5s 8.4s forwards;
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
        .v3-screen {
          background: #fff;
          border-radius: 26px;
          padding: 36px;
        }
        .v3-screen-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(14, 124, 102, 0.18);
        }
        .v3-screen-brand {
          font-size: 18px;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: #0e7c66;
          text-transform: uppercase;
        }
        .v3-screen-mini-timer {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          padding: 8px 16px;
          border-radius: 8px;
          letter-spacing: 0.04em;
        }
        .v3-screen-title {
          margin-top: 22px;
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -0.022em;
          color: #0a1f1d;
        }
        .v3-screen-sub {
          margin-top: 8px;
          font-size: 20px;
          color: #4b6864;
        }
        .v3-fields {
          margin-top: 26px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .v3-field {
          padding: 20px 26px;
          background: rgba(14, 124, 102, 0.06);
          border: 1px solid rgba(14, 124, 102, 0.2);
          border-radius: 14px;
          opacity: 0;
          transform: translateY(10px);
        }
        .v3-field.f1 {
          animation: vs-field-in 0.45s 3.2s forwards;
        }
        .v3-field.f2 {
          animation: vs-field-in 0.45s 4.4s forwards;
        }
        .v3-field.f3 {
          animation: vs-field-in 0.45s 5.6s forwards;
        }
        .v3-field.f4 {
          animation: vs-field-in 0.45s 6.8s forwards;
        }
        @keyframes vs-field-in {
          0% {
            opacity: 0;
            transform: translateY(14px);
            background: rgba(34, 184, 160, 0.3);
          }
          70% {
            background: rgba(34, 184, 160, 0.3);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            background: rgba(14, 124, 102, 0.06);
          }
        }
        .v3-field-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 14px;
          letter-spacing: 0.14em;
          font-weight: 700;
          color: #4b6864;
          text-transform: uppercase;
        }
        .v3-field-v {
          margin-top: 6px;
          font-size: 26px;
          font-weight: 800;
          color: #0a1f1d;
          font-variant-numeric: tabular-nums;
        }
        .v3-submit {
          margin-top: 26px;
          padding: 22px;
          text-align: center;
          background: linear-gradient(135deg, #062c29 0%, #0e7c66 100%);
          color: #fff;
          border-radius: 14px;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 0.02em;
          opacity: 0;
          animation:
            vs-in-up 0.4s 7.8s forwards,
            vs-pulse 0.6s 8.2s 1;
        }
        @keyframes vs-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.04);
          }
        }

        /* pre-qualified result headline (post-tablet) */
        .v3-result-eyebrow {
          position: absolute;
          top: 480px;
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
          animation: vs-in-up 0.6s 8.8s forwards;
        }
        .v3-result-h {
          position: absolute;
          top: 550px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #fff;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.5);
          opacity: 0;
          animation: vs-num-in 0.7s 9s forwards;
        }
        .v3-result-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* rails */
        .v3-rails {
          position: absolute;
          top: 800px;
          left: 80px;
          right: 80px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .v3-rail {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 26px 32px;
          background: rgba(34, 184, 160, 0.14);
          border: 1px solid rgba(34, 184, 160, 0.42);
          border-radius: 18px;
          font-size: 32px;
          backdrop-filter: blur(14px);
          opacity: 0;
        }
        .v3-rail-1 {
          animation: vs-rail-in 0.45s 9.8s forwards;
        }
        .v3-rail-2 {
          animation: vs-rail-in 0.45s 10.3s forwards;
        }
        .v3-rail-3 {
          animation: vs-rail-in 0.45s 10.8s forwards;
        }
        @keyframes vs-rail-in {
          0% {
            opacity: 0;
            transform: translateX(-40px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .v3-rail-l {
          display: inline-flex;
          align-items: center;
          gap: 18px;
          color: #fff;
          font-weight: 700;
        }
        .v3-rail-c {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          background: rgba(34, 184, 160, 0.4);
          color: ${TEAL_2};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 22px;
        }
        .v3-rail-amt {
          color: ${TEAL_2};
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          font-size: 38px;
        }

        /* Funded stamp */
        .v3-stamp {
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
          animation: vs-stamp-in 0.55s 11.8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
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
        .v3-stamp em {
          font-style: normal;
          color: ${TEAL_2};
        }

        .v3-cta {
          position: absolute;
          bottom: 200px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.55s 13s forwards;
        }
        .v3-cta-btn {
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
          animation: vs-pulse-loop 1.8s 13.5s infinite;
        }
        @keyframes vs-pulse-loop {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }
        .v3-discl {
          position: absolute;
          bottom: 56px;
          left: 56px;
          right: 56px;
          font-size: 15px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.55s 13.4s forwards;
        }
      `}
    >
      <div className="v3-mark">
        <span className="v3-mark-sq" />
        <span>
          <span className="v3-mark-l">Med</span>
          <span className="v3-mark-slash">/</span>
          <span>Pay</span>
        </span>
      </div>
      <div className="v3-tag">Operational speed</div>

      <div className="v3-timer-label">Patient pre-qual · live</div>
      <div className="v3-timer">
        <span className="v3-timer-tick t0">0:00</span>
        <span className="v3-timer-tick t1">0:01</span>
        <span className="v3-timer-tick t2">0:02</span>
        <span className="v3-timer-tick t3">0:03</span>
        <span className="v3-timer-tick t4">0:04</span>
        <span className="v3-timer-tick t5">0:05</span>
        <span className="v3-timer-tick t6">0:06</span>
        <span className="v3-timer-tick t7">0:07</span>
        <span className="v3-timer-tick t8">0:08</span>
      </div>

      <div className="v3-tablet">
        <div className="v3-screen">
          <div className="v3-screen-head">
            <span className="v3-screen-brand">MedPay · pre-qual</span>
            <span className="v3-screen-mini-timer">0:08</span>
          </div>
          <div className="v3-screen-title">Quick pre-qual</div>
          <div className="v3-screen-sub">Soft pull · zero impact on credit</div>
          <div className="v3-fields">
            <div className="v3-field f1">
              <div className="v3-field-k">Email</div>
              <div className="v3-field-v">jordan@example.com</div>
            </div>
            <div className="v3-field f2">
              <div className="v3-field-k">Date of birth</div>
              <div className="v3-field-v">04 / 12 / 1985</div>
            </div>
            <div className="v3-field f3">
              <div className="v3-field-k">Last 4 SSN</div>
              <div className="v3-field-v">••••</div>
            </div>
            <div className="v3-field f4">
              <div className="v3-field-k">Treatment budget</div>
              <div className="v3-field-v">$10k – $25k</div>
            </div>
          </div>
          <div className="v3-submit">Submit · run pre-qualification</div>
        </div>
      </div>

      <div className="v3-result-eyebrow">Pre-qualified · all 3 rails</div>
      <div className="v3-result-h">
        Jordan M. · <em>Tier A</em>
      </div>

      <div className="v3-rails">
        <div className="v3-rail v3-rail-1">
          <span className="v3-rail-l">
            <span className="v3-rail-c">✓</span> Consumer-direct
          </span>
          <span className="v3-rail-amt">$14,200</span>
        </div>
        <div className="v3-rail v3-rail-2">
          <span className="v3-rail-l">
            <span className="v3-rail-c">✓</span> Merchant-direct
          </span>
          <span className="v3-rail-amt">$18,500</span>
        </div>
        <div className="v3-rail v3-rail-3">
          <span className="v3-rail-l">
            <span className="v3-rail-c">✓</span> BNPL
          </span>
          <span className="v3-rail-amt">$5,000</span>
        </div>
      </div>

      <div className="v3-stamp">
        Funded · <em>8.7s</em>
      </div>

      <div className="v3-cta">
        <div className="v3-cta-btn">See it in action →</div>
      </div>

      <div className="v3-discl">
        EazePay, LLC · NMLS #2456701 · Loans subject to lender approval. Soft-pull pre-qualification
        has zero impact on credit score. Not a guarantee of approval.
      </div>
    </VideoStage>
  );
}
