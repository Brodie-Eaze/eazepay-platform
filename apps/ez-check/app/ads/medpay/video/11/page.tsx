/**
 * Video ad V11 — "Your closer talks to qualified buyers" · 18s · 1080×1920
 *
 * Practice-owner POV Facebook scroll-stopper. The single message: your
 * closer's time goes to buyers who can pay, not info-shoppers. Ecosystem
 * mechanics (smart form → financial pre-qual → smart routing → closer
 * call → lender marketplace → funded) are the PROOF behind that message,
 * not a 6-step product tour.
 *
 *   0.0–2.4   HOOK   · two phones side-by-side · "Same closer. Different call."
 *   2.4–3.4   PIVOT  · "MedPay routes only qualified buyers to your closer"
 *   3.4–5.9   PROOF  · smart form · financial check returns Tier A · $14.2k
 *   5.9–7.9   PROOF  · smart routing splits Tier A/B/below
 *   7.9–11.1  PAYOFF · closer call w/ pre-approved buyer (money shot)
 *  11.1–13.6  PROOF  · 1 application · 5 lenders · funded $15,200
 *  13.6–15.6  STAMP  · "Your closer talks to qualified buyers"
 *  15.6–18.0  CTA + compliance
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
        @keyframes v11-stamp-in {
          0% {
            opacity: 0;
            transform: scale(1.18);
          }
          70% {
            opacity: 1;
            transform: scale(0.97);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* ============ ACT 1 · hook · two phones (0–2.4s) ================ */
        .v11-act1 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 0.1s forwards,
            vs-fade-out 0.4s 2.4s forwards;
        }
        .v11-hook-h {
          position: absolute;
          top: 170px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.034em;
          line-height: 1.05;
          color: #fff;
          text-shadow: 0 0 40px rgba(34, 184, 160, 0.25);
        }
        .v11-hook-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-hook-sub {
          position: absolute;
          top: 280px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          letter-spacing: 0.28em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.55);
          text-transform: uppercase;
        }

        /* the two phone mockups */
        .v11-phones {
          position: absolute;
          top: 360px;
          left: 30px;
          right: 30px;
          bottom: 260px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .v11-phone {
          position: relative;
          padding: 22px 18px 26px;
          border-radius: 32px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(14px);
          display: flex;
          flex-direction: column;
        }
        .v11-phone-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 12px;
          letter-spacing: 0.22em;
          font-weight: 700;
          text-transform: uppercase;
        }
        .v11-phone.is-bad .v11-phone-tag {
          color: rgba(248, 113, 113, 0.85);
        }
        .v11-phone.is-good .v11-phone-tag {
          color: ${TEAL_2};
        }
        .v11-phone-callerid {
          margin-top: 10px;
          padding: 14px 14px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
        }
        .v11-phone-name {
          font-size: 21px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.015em;
        }
        .v11-phone-meta {
          margin-top: 4px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
        .v11-phone.is-good .v11-phone-meta {
          color: ${TEAL_2};
        }
        .v11-phone-quote {
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 16px;
          line-height: 1.35;
          color: #fff;
        }
        .v11-phone.is-bad .v11-phone-quote {
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.25);
          color: rgba(255, 255, 255, 0.85);
        }
        .v11-phone.is-good .v11-phone-quote {
          background: rgba(34, 184, 160, 0.12);
          border: 1px solid rgba(34, 184, 160, 0.35);
        }
        .v11-phone-outcome {
          margin-top: auto;
          padding-top: 12px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.22em;
          font-weight: 700;
          text-transform: uppercase;
          text-align: center;
        }
        .v11-phone.is-bad .v11-phone-outcome {
          color: rgba(248, 113, 113, 0.85);
        }
        .v11-phone.is-good .v11-phone-outcome {
          color: ${TEAL_2};
        }
        .v11-phone.is-good {
          border-color: rgba(34, 184, 160, 0.55);
          box-shadow: 0 20px 60px -20px rgba(34, 184, 160, 0.4);
        }

        /* ============ ACT 2 · pivot (2.4–3.4s) =========================== */
        .v11-act2 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 2.5s forwards,
            vs-fade-out 0.4s 3.3s forwards;
        }
        .v11-pivot-h {
          position: absolute;
          top: 770px;
          left: 50px;
          right: 50px;
          text-align: center;
          font-size: 76px;
          font-weight: 800;
          letter-spacing: -0.036em;
          line-height: 1.04;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.3);
        }
        .v11-pivot-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ============ ACT 3 · smart form + pre-qual (3.4–5.9s) ========== */
        .v11-act3 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.45s 3.5s forwards,
            vs-fade-out 0.4s 5.8s forwards;
        }
        .v11-step-tag {
          position: absolute;
          top: 250px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 15px;
          letter-spacing: 0.3em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v11-step-h {
          position: absolute;
          top: 305px;
          left: 30px;
          right: 30px;
          text-align: center;
          font-size: 52px;
          font-weight: 800;
          letter-spacing: -0.028em;
          line-height: 1.05;
          color: #fff;
        }
        .v11-step-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-form {
          position: absolute;
          top: 540px;
          left: 90px;
          right: 90px;
          padding: 22px;
          border-radius: 26px;
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(34, 184, 160, 0.35);
          box-shadow: 0 30px 70px -20px rgba(34, 184, 160, 0.4);
        }
        .v11-form-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 16px;
          margin-bottom: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          opacity: 0;
        }
        .v11-form-row:last-child {
          margin-bottom: 0;
        }
        .v11-form-row:nth-child(1) {
          animation: vs-in-up 0.3s 3.8s forwards;
        }
        .v11-form-row:nth-child(2) {
          animation: vs-in-up 0.3s 4s forwards;
        }
        .v11-form-row:nth-child(3) {
          animation: vs-in-up 0.3s 4.2s forwards;
        }
        .v11-form-row:nth-child(4) {
          animation: vs-in-up 0.3s 4.4s forwards;
        }
        .v11-form-label {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 12px;
          letter-spacing: 0.16em;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
        }
        .v11-form-val {
          font-weight: 700;
          font-size: 16px;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }
        .v11-form-val::after {
          content: ' ✓';
          color: ${TEAL_2};
        }
        .v11-finchk {
          position: absolute;
          top: 1080px;
          left: 60px;
          right: 60px;
          padding: 22px 26px;
          border-radius: 22px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.16), transparent 60%),
            rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(34, 184, 160, 0.55);
          box-shadow: 0 30px 70px -16px rgba(34, 184, 160, 0.5);
          opacity: 0;
          animation: vs-in-up 0.45s 4.8s forwards;
        }
        .v11-finchk-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 12px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v11-finchk-h {
          margin-top: 6px;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #fff;
        }
        .v11-finchk-sub {
          margin-top: 3px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
        }
        .v11-finchk-cells {
          margin-top: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .v11-finchk-cell {
          padding: 14px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(34, 184, 160, 0.3);
          border-radius: 12px;
          text-align: center;
        }
        .v11-finchk-cell-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
        }
        .v11-finchk-cell-v {
          margin-top: 5px;
          font-size: 26px;
          font-weight: 800;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }
        .v11-finchk-cell-v.is-teal {
          color: ${TEAL_2};
        }

        /* ============ ACT 4 · smart routing (5.9–7.9s) ================== */
        .v11-act4 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.45s 6s forwards,
            vs-fade-out 0.4s 7.8s forwards;
        }
        .v11-route-src {
          position: absolute;
          top: 510px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 22px;
          background: rgba(34, 184, 160, 0.18);
          border: 1px solid rgba(34, 184, 160, 0.55);
          border-radius: 999px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 16px;
          font-weight: 700;
          color: ${TEAL_2};
          letter-spacing: 0.04em;
        }
        .v11-route-tracks {
          position: absolute;
          top: 640px;
          left: 30px;
          right: 30px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .v11-track {
          padding: 18px 22px;
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.1);
          opacity: 0.32;
          backdrop-filter: blur(14px);
        }
        .v11-track.is-active {
          opacity: 1;
          border-color: rgba(34, 184, 160, 0.7);
          box-shadow: 0 20px 50px -20px rgba(34, 184, 160, 0.5);
        }
        .v11-track-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .v11-track-tier {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 12px;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v11-track-dest {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
        }
        .v11-track-h {
          margin-top: 6px;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.018em;
          color: #fff;
        }
        .v11-track-b {
          margin-top: 4px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.55);
        }
        .v11-track-1 {
          animation: v11-track-pulse 0.4s 6.6s forwards;
        }
        @keyframes v11-track-pulse {
          0% {
            opacity: 0.32;
          }
          100% {
            opacity: 1;
            border-color: rgba(34, 184, 160, 0.7);
            box-shadow: 0 20px 50px -20px rgba(34, 184, 160, 0.5);
          }
        }
        .v11-route-only {
          position: absolute;
          top: 1340px;
          left: 30px;
          right: 30px;
          padding: 14px 22px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(34, 184, 160, 0.5);
          border-radius: 14px;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation: vs-in-up 0.4s 7.1s forwards;
        }

        /* ============ ACT 5 · closer call · MONEY SHOT (7.9–11.1s) ===== */
        .v11-act5 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.45s 8s forwards,
            vs-fade-out 0.4s 11s forwards;
        }
        .v11-call-tag {
          position: absolute;
          top: 220px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 15px;
          letter-spacing: 0.3em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v11-call-h {
          position: absolute;
          top: 275px;
          left: 30px;
          right: 30px;
          text-align: center;
          font-size: 48px;
          font-weight: 800;
          letter-spacing: -0.024em;
          line-height: 1.05;
          color: #fff;
        }
        .v11-call-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        .v11-call {
          position: absolute;
          top: 460px;
          left: 60px;
          right: 60px;
          padding: 24px;
          border-radius: 28px;
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(34, 184, 160, 0.55);
          box-shadow: 0 30px 70px -16px rgba(34, 184, 160, 0.5);
        }
        .v11-call-id {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(34, 184, 160, 0.3);
          border-radius: 16px;
        }
        .v11-call-name {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.015em;
        }
        .v11-call-name em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-call-time {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 12px;
          letter-spacing: 0.16em;
          color: rgba(255, 255, 255, 0.55);
          text-align: right;
        }
        .v11-call-status {
          margin-top: 2px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }

        .v11-call-preapp {
          margin-top: 14px;
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.3), rgba(34, 184, 160, 0.16));
          border: 1px solid rgba(34, 184, 160, 0.65);
          border-radius: 14px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 14px;
          align-items: center;
        }
        .v11-call-preapp-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v11-call-preapp-v {
          font-size: 26px;
          font-weight: 800;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }
        .v11-call-preapp-tier {
          padding: 5px 11px;
          background: rgba(34, 184, 160, 0.22);
          border: 1px solid rgba(34, 184, 160, 0.55);
          border-radius: 999px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          font-weight: 700;
          color: ${TEAL_2};
          letter-spacing: 0.04em;
        }

        .v11-call-msgs {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .v11-call-msg {
          padding: 12px 14px;
          font-size: 16px;
          line-height: 1.35;
          border-radius: 14px;
          max-width: 86%;
          opacity: 0;
        }
        .v11-call-msg.is-closer {
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.85);
          border-bottom-left-radius: 4px;
        }
        .v11-call-msg.is-buyer {
          align-self: flex-end;
          background: rgba(34, 184, 160, 0.18);
          border: 1px solid rgba(34, 184, 160, 0.45);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .v11-call-msgs .v11-call-msg:nth-child(1) {
          animation: vs-in-up 0.35s 8.8s forwards;
        }
        .v11-call-msgs .v11-call-msg:nth-child(2) {
          animation: vs-in-up 0.35s 9.6s forwards;
        }
        .v11-call-who {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.22em;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        .v11-call-msg.is-closer .v11-call-who {
          color: rgba(255, 255, 255, 0.45);
        }
        .v11-call-msg.is-buyer .v11-call-who {
          color: ${TEAL_2};
        }

        .v11-call-outcome {
          position: absolute;
          top: 1300px;
          left: 60px;
          right: 60px;
          padding: 16px 22px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.45), rgba(34, 184, 160, 0.22));
          border: 1px solid rgba(34, 184, 160, 0.7);
          border-radius: 16px;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 14px;
          letter-spacing: 0.24em;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          opacity: 0;
          animation: v11-stamp-in 0.45s 10.4s forwards;
        }
        .v11-call-outcome em {
          color: ${TEAL_2};
          font-style: normal;
        }

        /* ============ ACT 6 · lender marketplace (11.1–13.6s) ========== */
        .v11-act6 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 11.2s forwards,
            vs-fade-out 0.4s 13.5s forwards;
        }
        .v11-mkt-tag {
          position: absolute;
          top: 250px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 15px;
          letter-spacing: 0.3em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v11-mkt-h {
          position: absolute;
          top: 305px;
          left: 30px;
          right: 30px;
          text-align: center;
          font-size: 52px;
          font-weight: 800;
          letter-spacing: -0.028em;
          line-height: 1.05;
          color: #fff;
        }
        .v11-mkt-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-mkt-app {
          position: absolute;
          top: 500px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 24px;
          background: rgba(34, 184, 160, 0.18);
          border: 1px solid rgba(34, 184, 160, 0.6);
          border-radius: 999px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 14px;
          font-weight: 700;
          color: ${TEAL_2};
          letter-spacing: 0.08em;
        }
        .v11-mkt-lenders {
          position: absolute;
          top: 610px;
          left: 30px;
          right: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .v11-lender {
          padding: 16px 18px;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          opacity: 0;
        }
        .v11-lender:nth-child(1) {
          animation: vs-in-up 0.3s 11.6s forwards;
        }
        .v11-lender:nth-child(2) {
          animation: vs-in-up 0.3s 11.75s forwards;
        }
        .v11-lender:nth-child(3) {
          animation: vs-in-up 0.3s 11.9s forwards;
        }
        .v11-lender:nth-child(4) {
          animation: vs-in-up 0.3s 12.05s forwards;
        }
        .v11-lender:nth-child(5) {
          animation: vs-in-up 0.3s 12.2s forwards;
        }
        .v11-lender.is-best {
          border-color: rgba(34, 184, 160, 0.85);
          background:
            linear-gradient(135deg, rgba(14, 124, 102, 0.3), rgba(34, 184, 160, 0.18)),
            rgba(15, 23, 42, 0.85);
          box-shadow: 0 20px 50px -16px rgba(34, 184, 160, 0.6);
        }
        .v11-lender.is-decline {
          opacity: 0.55;
        }
        .v11-lender-name {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
        }
        .v11-lender-dec {
          margin-top: 4px;
          font-size: 18px;
          font-weight: 800;
          color: #fff;
        }
        .v11-lender.is-decline .v11-lender-dec {
          color: rgba(248, 113, 113, 0.85);
        }
        .v11-lender.is-best .v11-lender-dec {
          color: ${TEAL_2};
        }
        .v11-lender-tag {
          margin-top: 6px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
        }
        .v11-lender.is-best .v11-lender-tag {
          color: ${TEAL_2};
        }

        .v11-mkt-stamp {
          position: absolute;
          top: 1320px;
          left: 30px;
          right: 30px;
          padding: 20px 24px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.45), rgba(34, 184, 160, 0.22));
          border: 1px solid rgba(34, 184, 160, 0.7);
          border-radius: 18px;
          text-align: center;
          opacity: 0;
          animation: v11-stamp-in 0.5s 12.6s forwards;
        }
        .v11-mkt-stamp-h {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #fff;
        }
        .v11-mkt-stamp-h em {
          font-style: normal;
          color: ${TEAL_2};
          font-variant-numeric: tabular-nums;
        }
        .v11-mkt-stamp-b {
          margin-top: 4px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 12px;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.55);
          text-transform: uppercase;
        }

        /* ============ ACT 7 · stamp · the message (13.6–15.6s) ========= */
        .v11-act7 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation: vs-in-up 0.55s 13.7s forwards;
        }
        .v11-final-h {
          position: absolute;
          top: 420px;
          left: 30px;
          right: 30px;
          text-align: center;
          font-size: 82px;
          font-weight: 800;
          letter-spacing: -0.036em;
          line-height: 1.03;
          color: #fff;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.4);
        }
        .v11-final-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-final-sub {
          position: absolute;
          top: 700px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          letter-spacing: 0.3em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.65);
          text-transform: uppercase;
        }
        .v11-final-sub em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-final-mark {
          position: absolute;
          top: 800px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.034em;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>MedPay · qualified buyers</Tag>

      {/* ─── ACT 1 · hook · two phones ──────────────────────────────── */}
      <section className="v11-act1">
        <h1 className="v11-hook-h">
          Same closer. <em>Different call.</em>
        </h1>
        <div className="v11-hook-sub">Practice owners · who&apos;s on the line</div>
        <div className="v11-phones">
          <div className="v11-phone is-bad">
            <div className="v11-phone-tag">Without MedPay</div>
            <div className="v11-phone-callerid">
              <div className="v11-phone-name">Mike → Lead 47</div>
              <div className="v11-phone-meta">Inbound · 14 min · no record</div>
            </div>
            <div className="v11-phone-quote">
              <div className="v11-call-who">Lead</div>
              &ldquo;Just looking for info… I don&apos;t know what I can afford.&rdquo;
            </div>
            <div className="v11-phone-outcome">✗ No close · 14 min lost</div>
          </div>
          <div className="v11-phone is-good">
            <div className="v11-phone-tag">With MedPay</div>
            <div className="v11-phone-callerid">
              <div className="v11-phone-name">Mike → Sarah M.</div>
              <div className="v11-phone-meta">Tier A · $14,200 pre-approved</div>
            </div>
            <div className="v11-phone-quote">
              <div className="v11-call-who">Buyer</div>
              &ldquo;Pre-approved $14,200? Thursday works perfect.&rdquo;
            </div>
            <div className="v11-phone-outcome">✓ Closed · 4 min</div>
          </div>
        </div>
      </section>

      {/* ─── ACT 2 · pivot ──────────────────────────────────────────── */}
      <section className="v11-act2">
        <h2 className="v11-pivot-h">
          <em>MedPay</em> routes only qualified buyers to your closer.
        </h2>
      </section>

      {/* ─── ACT 3 · smart form + financial check ───────────────────── */}
      <section className="v11-act3">
        <div className="v11-step-tag">Smart form · pulls financial data</div>
        <h3 className="v11-step-h">
          4 fields. <em>We pre-qualify in seconds.</em>
        </h3>
        <div className="v11-form">
          <div className="v11-form-row">
            <span className="v11-form-label">Email</span>
            <span className="v11-form-val">sarah@gmail.com</span>
          </div>
          <div className="v11-form-row">
            <span className="v11-form-label">Date of birth</span>
            <span className="v11-form-val">03/14/1989</span>
          </div>
          <div className="v11-form-row">
            <span className="v11-form-label">Last 4 SSN</span>
            <span className="v11-form-val">••7421</span>
          </div>
          <div className="v11-form-row">
            <span className="v11-form-label">Budget</span>
            <span className="v11-form-val">$14,200</span>
          </div>
        </div>
        <div className="v11-finchk">
          <div className="v11-finchk-tag">↓ Financial pre-qual · auto</div>
          <div className="v11-finchk-h">Soft-pull · zero credit impact</div>
          <div className="v11-finchk-sub">Returns in &lt; 3 seconds</div>
          <div className="v11-finchk-cells">
            <div className="v11-finchk-cell">
              <div className="v11-finchk-cell-k">Credit</div>
              <div className="v11-finchk-cell-v">724</div>
            </div>
            <div className="v11-finchk-cell">
              <div className="v11-finchk-cell-k">Budget</div>
              <div className="v11-finchk-cell-v">$14k</div>
            </div>
            <div className="v11-finchk-cell">
              <div className="v11-finchk-cell-k">Tier</div>
              <div className="v11-finchk-cell-v is-teal">A</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ACT 4 · smart routing ──────────────────────────────────── */}
      <section className="v11-act4">
        <div className="v11-step-tag">Smart routing · by qualification</div>
        <h3 className="v11-step-h">
          Tier A reaches your closer. <em>Tire-kickers don&apos;t.</em>
        </h3>
        <div className="v11-route-src">Sarah · Tier A</div>
        <div className="v11-route-tracks">
          <div className="v11-track v11-track-1">
            <div className="v11-track-head">
              <span className="v11-track-tier">Tier A · high-ticket</span>
              <span className="v11-track-dest">→ Your closer</span>
            </div>
            <div className="v11-track-h">Senior closer · Thu 2:00 PM</div>
            <div className="v11-track-b">Pre-approved budget honored at consult.</div>
          </div>
          <div className="v11-track">
            <div className="v11-track-head">
              <span className="v11-track-tier">Tier B · mid-ticket</span>
              <span className="v11-track-dest">→ Consultation</span>
            </div>
            <div className="v11-track-h">Right-sized financing options</div>
            <div className="v11-track-b">Pre-qualified within their range.</div>
          </div>
          <div className="v11-track">
            <div className="v11-track-head">
              <span className="v11-track-tier">Below threshold</span>
              <span className="v11-track-dest">→ Nurture</span>
            </div>
            <div className="v11-track-h">Drip · re-qualify later</div>
            <div className="v11-track-b">Never wastes your closer&apos;s time.</div>
          </div>
        </div>
        <div className="v11-route-only">Only pre-approved buyers reach your team</div>
      </section>

      {/* ─── ACT 5 · closer call · THE MONEY SHOT ───────────────────── */}
      <section className="v11-act5">
        <div className="v11-call-tag">Your closer · already knows the budget</div>
        <h3 className="v11-call-h">
          They pick up <em>pre-approved.</em>
        </h3>
        <div className="v11-call">
          <div className="v11-call-id">
            <div>
              <div className="v11-call-name">
                Mike → <em>Sarah M.</em>
              </div>
              <div className="v11-call-status">● Live · 4 min 12 sec</div>
            </div>
            <div className="v11-call-time">
              <div>Thu 2:05 PM</div>
              <div className="v11-call-status">Outbound</div>
            </div>
          </div>
          <div className="v11-call-preapp">
            <div>
              <div className="v11-call-preapp-k">Pre-approved</div>
              <div className="v11-call-preapp-v">$14,200</div>
            </div>
            <div></div>
            <div className="v11-call-preapp-tier">Tier A · 724</div>
          </div>
          <div className="v11-call-msgs">
            <div className="v11-call-msg is-closer">
              <div className="v11-call-who">Mike (closer)</div>
              &ldquo;Sarah, you&apos;re pre-approved for $14,200 — want to start Thursday or next
              week?&rdquo;
            </div>
            <div className="v11-call-msg is-buyer">
              <div className="v11-call-who">Sarah (buyer)</div>
              &ldquo;Thursday. Let&apos;s book it.&rdquo;
            </div>
          </div>
        </div>
        <div className="v11-call-outcome">
          ✓ <em>Closed in 4 min</em> · no objection · ready to fund
        </div>
      </section>

      {/* ─── ACT 6 · lender marketplace · funded ────────────────────── */}
      <section className="v11-act6">
        <div className="v11-mkt-tag">One application · every lender</div>
        <h3 className="v11-mkt-h">
          Instant decision. <em>Best terms picked for her.</em>
        </h3>
        <div className="v11-mkt-app">1 APPLICATION · 5 LENDERS · 8 SECONDS</div>
        <div className="v11-mkt-lenders">
          <div className="v11-lender">
            <div className="v11-lender-name">Lender A</div>
            <div className="v11-lender-dec">$14,200</div>
            <div className="v11-lender-tag">Approved · 11.9% APR</div>
          </div>
          <div className="v11-lender">
            <div className="v11-lender-name">Lender B</div>
            <div className="v11-lender-dec">$13,800</div>
            <div className="v11-lender-tag">Approved · 12.4% APR</div>
          </div>
          <div className="v11-lender is-best">
            <div className="v11-lender-name">Lender C</div>
            <div className="v11-lender-dec">$15,200</div>
            <div className="v11-lender-tag">★ Best terms · 9.8% APR</div>
          </div>
          <div className="v11-lender is-decline">
            <div className="v11-lender-name">Lender D</div>
            <div className="v11-lender-dec">—</div>
            <div className="v11-lender-tag">Declined</div>
          </div>
          <div className="v11-lender">
            <div className="v11-lender-name">Lender E</div>
            <div className="v11-lender-dec">$14,500</div>
            <div className="v11-lender-tag">Approved · 11.2% APR</div>
          </div>
        </div>
        <div className="v11-mkt-stamp">
          <div className="v11-mkt-stamp-h">
            <em>$15,200</em> funded · 48-hour wire
          </div>
          <div className="v11-mkt-stamp-b">Patient picked best terms · same visit</div>
        </div>
      </section>

      {/* ─── ACT 7 · stamp · the message ────────────────────────────── */}
      <section className="v11-act7">
        <h2 className="v11-final-h">
          Your closer talks to <em>qualified buyers.</em>
        </h2>
        <div className="v11-final-sub">Smart form · pre-qual · routing · funded</div>
        <div className="v11-final-mark">That&apos;s MedPay.</div>
      </section>

      <Cta label="Show me on my funnel" ctaDelay={15.8} disclDelay={16.2} />
    </VideoStage>
  );
}
