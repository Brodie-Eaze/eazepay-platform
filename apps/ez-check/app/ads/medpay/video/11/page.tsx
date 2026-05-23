/**
 * Video ad V11 v3 — "Hey practice owner" · 18s · 1080×1920
 *
 * Facebook-first direct-address ad. Stops the scroll by talking AT the
 * practice owner, not demoing the product. Structure:
 *
 *   0.0–2.8   HOOK    · "Hey practice owner — your closer wastes 80% of their day"
 *   2.8–5.5   PAIN    · their closer's call list · names marked no-show/declined
 *   5.5–7.2   PIVOT   · "MedPay only books qualified buyers"
 *   7.2–10.8  PROOF   · 3 plain-English steps · form → pre-qual → calendar
 *  10.8–14.6  WOW     · the actual closer's Monday dashboard · today's funded
 *  14.6–15.8  STAMP   · "Your closer talks to qualified buyers."
 *  15.8–18.0  CTA + compliance
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
            transform: scale(0.92) translateY(20px);
          }
          60% {
            opacity: 1;
            transform: scale(1.02) translateY(-2px);
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
        @keyframes v11-strike {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
        @keyframes v11-ring-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(34, 184, 160, 0);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(34, 184, 160, 0);
          }
        }

        /* ─── ACT 1 · direct-address hook (0–2.8s) ─────────────────────── */
        .v11-a1 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 0.1s forwards,
            vs-fade-out 0.4s 2.8s forwards;
        }
        .v11-a1-line-1 {
          position: absolute;
          top: 380px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: #fff;
          opacity: 0;
          animation: v11-blur-in 0.5s 0.4s forwards;
        }
        .v11-a1-line-2 {
          position: absolute;
          top: 530px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 76px;
          font-weight: 800;
          letter-spacing: -0.034em;
          line-height: 1.05;
          color: ${TEAL_2};
          padding: 0 80px;
          opacity: 0;
          animation: v11-blur-in 0.5s 1s forwards;
        }
        .v11-a1-stat {
          position: absolute;
          top: 820px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 280px;
          font-weight: 800;
          letter-spacing: -0.06em;
          line-height: 1;
          color: #fff;
          text-shadow: 0 0 80px rgba(34, 184, 160, 0.55);
          opacity: 0;
          animation: v11-pop-in 0.6s 1.5s forwards;
        }
        .v11-a1-stat em {
          font-style: normal;
          color: ${TEAL_2};
          font-size: 80px;
          letter-spacing: -0.02em;
          display: block;
          margin-top: 14px;
          line-height: 1.05;
        }
        .v11-a1-sub {
          position: absolute;
          top: 1340px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 36px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.3;
          padding: 0 60px;
          opacity: 0;
          animation: vs-in-up 0.45s 2s forwards;
        }
        .v11-a1-sub em {
          font-style: normal;
          color: ${TEAL_2};
          font-weight: 800;
        }

        /* ─── ACT 2 · pain · the call list (2.8–5.5s) ──────────────────── */
        .v11-a2 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 2.9s forwards,
            vs-fade-out 0.4s 5.4s forwards;
        }
        .v11-a2-h {
          position: absolute;
          top: 200px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 60px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: #fff;
        }
        .v11-a2-h em {
          font-style: normal;
          color: rgba(248, 113, 113, 0.95);
        }
        .v11-a2-sub {
          position: absolute;
          top: 360px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 26px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
        }
        .v11-a2-list {
          position: absolute;
          top: 460px;
          left: 60px;
          right: 60px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .v11-a2-row {
          display: grid;
          grid-template-columns: 96px 1fr auto;
          gap: 20px;
          align-items: center;
          padding: 22px 24px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(248, 113, 113, 0.18);
          border-radius: 18px;
          opacity: 0;
        }
        .v11-a2-row:nth-child(1) {
          animation: vs-in-up 0.3s 3.1s forwards;
        }
        .v11-a2-row:nth-child(2) {
          animation: vs-in-up 0.3s 3.3s forwards;
        }
        .v11-a2-row:nth-child(3) {
          animation: vs-in-up 0.3s 3.5s forwards;
        }
        .v11-a2-row:nth-child(4) {
          animation: vs-in-up 0.3s 3.7s forwards;
        }
        .v11-a2-row:nth-child(5) {
          animation: vs-in-up 0.3s 3.9s forwards;
        }
        .v11-a2-row:nth-child(6) {
          animation: vs-in-up 0.3s 4.1s forwards;
        }
        .v11-a2-row:nth-child(7) {
          animation: vs-in-up 0.3s 4.3s forwards;
        }
        .v11-a2-time {
          font-size: 22px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.55);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }
        .v11-a2-name {
          font-size: 28px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.92);
          letter-spacing: -0.015em;
        }
        .v11-a2-meta {
          font-size: 17px;
          font-weight: 600;
          color: rgba(248, 113, 113, 0.85);
          margin-top: 3px;
          letter-spacing: 0.01em;
        }
        .v11-a2-tag {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          padding: 7px 14px;
          background: rgba(248, 113, 113, 0.14);
          border: 1px solid rgba(248, 113, 113, 0.4);
          border-radius: 999px;
          color: rgba(248, 113, 113, 0.95);
        }
        .v11-a2-tally {
          position: absolute;
          bottom: 110px;
          left: 60px;
          right: 60px;
          text-align: center;
          padding: 22px 24px;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 18px;
          opacity: 0;
          animation: v11-pop-in 0.5s 4.6s forwards;
        }
        .v11-a2-tally-h {
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .v11-a2-tally-h em {
          font-style: normal;
          color: rgba(248, 113, 113, 0.95);
        }
        .v11-a2-tally-sub {
          margin-top: 4px;
          font-size: 18px;
          color: rgba(255, 255, 255, 0.55);
        }

        /* ─── ACT 3 · pivot (5.5–7.2s) ─────────────────────────────────── */
        .v11-a3 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 5.6s forwards,
            vs-fade-out 0.4s 7.1s forwards;
        }
        .v11-a3-pre {
          position: absolute;
          top: 660px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation: v11-blur-in 0.5s 5.8s forwards;
        }
        .v11-a3-h {
          position: absolute;
          top: 740px;
          left: 50px;
          right: 50px;
          text-align: center;
          font-size: 86px;
          font-weight: 800;
          letter-spacing: -0.038em;
          line-height: 1.03;
          color: #fff;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.4);
          opacity: 0;
          animation: v11-blur-in 0.6s 6.1s forwards;
        }
        .v11-a3-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-a3-sub {
          position: absolute;
          top: 1090px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 28px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: -0.005em;
          opacity: 0;
          animation: vs-in-up 0.45s 6.7s forwards;
        }
        .v11-a3-sub em {
          font-style: normal;
          color: ${TEAL_2};
          font-weight: 700;
        }

        /* ─── ACT 4 · 3 plain-English steps (7.2–10.8s) ─────────────────── */
        .v11-a4 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.4s 7.3s forwards,
            vs-fade-out 0.4s 10.7s forwards;
        }
        .v11-a4-h {
          position: absolute;
          top: 200px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 60px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: #fff;
        }
        .v11-a4-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-a4-steps {
          position: absolute;
          top: 380px;
          left: 50px;
          right: 50px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .v11-a4-step {
          display: grid;
          grid-template-columns: 130px 1fr;
          gap: 26px;
          padding: 26px 28px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(34, 184, 160, 0.3);
          border-radius: 22px;
          opacity: 0;
        }
        .v11-a4-step:nth-child(1) {
          animation: v11-pop-in 0.5s 7.6s forwards;
        }
        .v11-a4-step:nth-child(2) {
          animation: v11-pop-in 0.5s 8.3s forwards;
        }
        .v11-a4-step:nth-child(3) {
          animation: v11-pop-in 0.5s 9s forwards;
        }
        .v11-a4-step-n {
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.05em;
          color: ${TEAL_2};
          line-height: 1;
        }
        .v11-a4-step-body {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .v11-a4-step-h {
          font-size: 34px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.022em;
          line-height: 1.1;
        }
        .v11-a4-step-b {
          margin-top: 6px;
          font-size: 22px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.62);
          line-height: 1.35;
        }
        .v11-a4-step-b em {
          font-style: normal;
          color: ${TEAL_2};
          font-weight: 700;
        }
        .v11-a4-result {
          position: absolute;
          top: 1340px;
          left: 50px;
          right: 50px;
          padding: 24px 28px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.45), rgba(34, 184, 160, 0.22));
          border: 1px solid rgba(34, 184, 160, 0.65);
          border-radius: 22px;
          text-align: center;
          opacity: 0;
          animation: v11-pop-in 0.5s 9.7s forwards;
        }
        .v11-a4-result-h {
          font-size: 36px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.022em;
        }
        .v11-a4-result-h em {
          font-style: normal;
          color: ${TEAL_2};
          font-variant-numeric: tabular-nums;
        }

        /* ─── ACT 5 · the WOW · closer's Monday dashboard (10.8–14.6s) ──── */
        .v11-a5 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.45s 10.9s forwards,
            vs-fade-out 0.4s 14.5s forwards;
        }
        .v11-a5-pre {
          position: absolute;
          top: 175px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: ${TEAL_2};
        }
        .v11-a5-h {
          position: absolute;
          top: 220px;
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

        /* the dashboard frame */
        .v11-a5-app {
          position: absolute;
          top: 400px;
          left: 40px;
          right: 40px;
          padding: 22px;
          background: rgba(7, 14, 28, 0.96);
          border: 1px solid rgba(34, 184, 160, 0.3);
          border-radius: 28px;
          box-shadow: 0 40px 90px -16px rgba(34, 184, 160, 0.55);
        }
        .v11-a5-app-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 8px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .v11-a5-app-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.018em;
        }
        .v11-a5-app-brand .v11-dot-sq {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
        }
        .v11-a5-app-brand em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-a5-app-user {
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.55);
        }
        .v11-a5-app-user em {
          font-style: normal;
          color: #fff;
        }

        /* hero stats strip */
        .v11-a5-stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
          margin-top: 18px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .v11-a5-stat {
          padding: 14px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          text-align: center;
        }
        .v11-a5-stat.is-hero {
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.35), rgba(34, 184, 160, 0.18));
          border-color: rgba(34, 184, 160, 0.65);
        }
        .v11-a5-stat-k {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
        }
        .v11-a5-stat-v {
          margin-top: 6px;
          font-size: 36px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.025em;
          font-variant-numeric: tabular-nums;
        }
        .v11-a5-stat.is-hero .v11-a5-stat-v {
          color: ${TEAL_2};
        }

        /* today's call list */
        .v11-a5-list {
          margin-top: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .v11-a5-card {
          display: grid;
          grid-template-columns: 56px 1fr auto;
          gap: 18px;
          align-items: center;
          padding: 16px 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          opacity: 0;
        }
        .v11-a5-card:nth-child(1) {
          animation: vs-in-up 0.3s 11.4s forwards;
        }
        .v11-a5-card:nth-child(2) {
          animation: vs-in-up 0.3s 11.6s forwards;
        }
        .v11-a5-card:nth-child(3) {
          animation: vs-in-up 0.3s 11.8s forwards;
        }
        .v11-a5-card:nth-child(4) {
          animation: vs-in-up 0.3s 12s forwards;
        }
        .v11-a5-card:nth-child(5) {
          animation: vs-in-up 0.3s 12.2s forwards;
        }
        .v11-a5-card.is-funded {
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.18), rgba(34, 184, 160, 0.06));
          border-color: rgba(34, 184, 160, 0.45);
        }
        .v11-a5-card.is-live {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(34, 184, 160, 0.55);
          animation:
            vs-in-up 0.3s 12s forwards,
            v11-ring-pulse 1.6s 12.4s infinite;
        }
        .v11-a5-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e3a8a, #5b21b6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.01em;
        }
        .v11-a5-avatar.av-1 {
          background: linear-gradient(135deg, #be185d, #db2777);
        }
        .v11-a5-avatar.av-2 {
          background: linear-gradient(135deg, #1e3a8a, #3b82f6);
        }
        .v11-a5-avatar.av-3 {
          background: linear-gradient(135deg, #6d28d9, #a855f7);
        }
        .v11-a5-avatar.av-4 {
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
        }
        .v11-a5-avatar.av-5 {
          background: linear-gradient(135deg, #ca8a04, #facc15);
          color: #1a1a1a;
        }
        .v11-a5-who {
          display: flex;
          flex-direction: column;
        }
        .v11-a5-who-n {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.018em;
        }
        .v11-a5-who-m {
          margin-top: 3px;
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.55);
        }
        .v11-a5-who-m em {
          font-style: normal;
          color: ${TEAL_2};
          font-weight: 700;
        }
        .v11-a5-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .v11-a5-amount {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.015em;
        }
        .v11-a5-card.is-funded .v11-a5-amount {
          color: ${TEAL_2};
        }
        .v11-a5-pill {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.65);
        }
        .v11-a5-card.is-funded .v11-a5-pill {
          background: rgba(34, 184, 160, 0.22);
          color: ${TEAL_2};
        }
        .v11-a5-card.is-live .v11-a5-pill {
          background: rgba(34, 184, 160, 0.55);
          color: #fff;
        }
        .v11-a5-card.is-live .v11-a5-pill::before {
          content: '●';
          color: #fff;
          margin-right: 5px;
          animation: v11-ring-pulse 1.2s infinite;
        }

        /* ─── ACT 6 · stamp · the message (14.6–15.8s) ─────────────────── */
        .v11-a6 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation: vs-in-up 0.55s 14.7s forwards;
        }
        .v11-a6-h {
          position: absolute;
          top: 580px;
          left: 30px;
          right: 30px;
          text-align: center;
          font-size: 84px;
          font-weight: 800;
          letter-spacing: -0.036em;
          line-height: 1.03;
          color: #fff;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.4);
        }
        .v11-a6-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-a6-mark {
          position: absolute;
          top: 900px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 68px;
          font-weight: 800;
          letter-spacing: -0.034em;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>MedPay · for practice owners</Tag>

      {/* ─── ACT 1 · direct-address hook ──────────────────────────────── */}
      <section className="v11-a1">
        <div className="v11-a1-line-1">Practice owner —</div>
        <div className="v11-a1-line-2">your closer spends</div>
        <div className="v11-a1-stat">
          80%
          <em>of their day on people who can&apos;t pay.</em>
        </div>
        <div className="v11-a1-sub">
          80 dials. 47 &ldquo;just info.&rdquo; 21 no-shows. <em>6 funded.</em>
        </div>
      </section>

      {/* ─── ACT 2 · their closer's call list ─────────────────────────── */}
      <section className="v11-a2">
        <h2 className="v11-a2-h">
          Sound like <em>yesterday?</em>
        </h2>
        <div className="v11-a2-sub">Mike&apos;s actual call log · Tuesday</div>
        <div className="v11-a2-list">
          <div className="v11-a2-row">
            <div className="v11-a2-time">9:00</div>
            <div>
              <div className="v11-a2-name">Sarah M.</div>
              <div className="v11-a2-meta">Cancelled · couldn&apos;t afford</div>
            </div>
            <div className="v11-a2-tag">✗ Cancel</div>
          </div>
          <div className="v11-a2-row">
            <div className="v11-a2-time">9:30</div>
            <div>
              <div className="v11-a2-name">Mike R.</div>
              <div className="v11-a2-meta">No-show · second this week</div>
            </div>
            <div className="v11-a2-tag">✗ Ghost</div>
          </div>
          <div className="v11-a2-row">
            <div className="v11-a2-time">10:00</div>
            <div>
              <div className="v11-a2-name">Lisa K.</div>
              <div className="v11-a2-meta">Declined at checkout</div>
            </div>
            <div className="v11-a2-tag">✗ Declined</div>
          </div>
          <div className="v11-a2-row">
            <div className="v11-a2-time">10:30</div>
            <div>
              <div className="v11-a2-name">John D.</div>
              <div className="v11-a2-meta">&ldquo;Just looking for info.&rdquo;</div>
            </div>
            <div className="v11-a2-tag">✗ No close</div>
          </div>
          <div className="v11-a2-row">
            <div className="v11-a2-time">11:00</div>
            <div>
              <div className="v11-a2-name">Priya N.</div>
              <div className="v11-a2-meta">No answer · 3rd attempt</div>
            </div>
            <div className="v11-a2-tag">✗ Miss</div>
          </div>
        </div>
        <div className="v11-a2-tally">
          <div className="v11-a2-tally-h">
            5 calls in 2 hours. <em>0 closes.</em>
          </div>
          <div className="v11-a2-tally-sub">And it&apos;s only 11 AM.</div>
        </div>
      </section>

      {/* ─── ACT 3 · pivot ────────────────────────────────────────────── */}
      <section className="v11-a3">
        <div className="v11-a3-pre">Here&apos;s the fix</div>
        <h2 className="v11-a3-h">
          MedPay only books <em>qualified buyers</em> for your closer.
        </h2>
        <div className="v11-a3-sub">
          Pre-approved · <em>real budget</em> · ready to pay
        </div>
      </section>

      {/* ─── ACT 4 · 3 plain-English steps ────────────────────────────── */}
      <section className="v11-a4">
        <h2 className="v11-a4-h">
          Here&apos;s what happens <em>before they pick up.</em>
        </h2>
        <div className="v11-a4-steps">
          <div className="v11-a4-step">
            <div className="v11-a4-step-n">1</div>
            <div className="v11-a4-step-body">
              <div className="v11-a4-step-h">Patient fills your form.</div>
              <div className="v11-a4-step-b">4 fields. Same one you use today.</div>
            </div>
          </div>
          <div className="v11-a4-step">
            <div className="v11-a4-step-n">2</div>
            <div className="v11-a4-step-body">
              <div className="v11-a4-step-h">MedPay pre-qualifies them.</div>
              <div className="v11-a4-step-b">
                Credit, budget, tier — <em>soft-pull, zero impact.</em>
              </div>
            </div>
          </div>
          <div className="v11-a4-step">
            <div className="v11-a4-step-n">3</div>
            <div className="v11-a4-step-body">
              <div className="v11-a4-step-h">Books straight to your closer.</div>
              <div className="v11-a4-step-b">
                <em>Only if they qualify.</em> Tire-kickers go to nurture.
              </div>
            </div>
          </div>
        </div>
        <div className="v11-a4-result">
          <div className="v11-a4-result-h">
            <em>Every</em> call your closer takes is a buyer.
          </div>
        </div>
      </section>

      {/* ─── ACT 5 · THE WOW · closer's Monday dashboard ──────────────── */}
      <section className="v11-a5">
        <div className="v11-a5-pre">Monday · 11 AM</div>
        <h3 className="v11-a5-h">
          Here&apos;s what your closer sees <em>inside MedPay.</em>
        </h3>
        <div className="v11-a5-app">
          <div className="v11-a5-app-top">
            <div className="v11-a5-app-brand">
              <span className="v11-dot-sq" />
              <span>
                <em>Med</em>Pay
              </span>
            </div>
            <div className="v11-a5-app-user">
              <em>Mike (closer)</em> · today&apos;s queue
            </div>
          </div>
          <div className="v11-a5-stats">
            <div className="v11-a5-stat">
              <div className="v11-a5-stat-k">Calls</div>
              <div className="v11-a5-stat-v">5</div>
            </div>
            <div className="v11-a5-stat">
              <div className="v11-a5-stat-k">Funded</div>
              <div className="v11-a5-stat-v">4</div>
            </div>
            <div className="v11-a5-stat is-hero">
              <div className="v11-a5-stat-k">Today</div>
              <div className="v11-a5-stat-v">$48k</div>
            </div>
          </div>
          <div className="v11-a5-list">
            <div className="v11-a5-card is-funded">
              <div className="v11-a5-avatar av-1">SM</div>
              <div className="v11-a5-who">
                <div className="v11-a5-who-n">Sarah M.</div>
                <div className="v11-a5-who-m">
                  Pre-approved <em>$14,200</em> · Tier A
                </div>
              </div>
              <div className="v11-a5-status">
                <div className="v11-a5-amount">$14,200</div>
                <div className="v11-a5-pill">✓ Funded</div>
              </div>
            </div>
            <div className="v11-a5-card is-funded">
              <div className="v11-a5-avatar av-2">JK</div>
              <div className="v11-a5-who">
                <div className="v11-a5-who-n">Jordan K.</div>
                <div className="v11-a5-who-m">
                  Pre-approved <em>$22,000</em> · Tier A
                </div>
              </div>
              <div className="v11-a5-status">
                <div className="v11-a5-amount">$22,000</div>
                <div className="v11-a5-pill">✓ Funded</div>
              </div>
            </div>
            <div className="v11-a5-card is-funded">
              <div className="v11-a5-avatar av-3">PN</div>
              <div className="v11-a5-who">
                <div className="v11-a5-who-n">Priya N.</div>
                <div className="v11-a5-who-m">
                  Pre-approved <em>$8,500</em> · Tier B
                </div>
              </div>
              <div className="v11-a5-status">
                <div className="v11-a5-amount">$8,500</div>
                <div className="v11-a5-pill">✓ Funded</div>
              </div>
            </div>
            <div className="v11-a5-card is-live">
              <div className="v11-a5-avatar av-4">DM</div>
              <div className="v11-a5-who">
                <div className="v11-a5-who-n">Devon M.</div>
                <div className="v11-a5-who-m">
                  Pre-approved <em>$3,300</em> · live now
                </div>
              </div>
              <div className="v11-a5-status">
                <div className="v11-a5-amount">$3,300</div>
                <div className="v11-a5-pill">Live</div>
              </div>
            </div>
            <div className="v11-a5-card">
              <div className="v11-a5-avatar av-5">AL</div>
              <div className="v11-a5-who">
                <div className="v11-a5-who-n">Alex L.</div>
                <div className="v11-a5-who-m">
                  Pre-approved <em>$11,400</em> · 1:30 PM
                </div>
              </div>
              <div className="v11-a5-status">
                <div className="v11-a5-amount">$11,400</div>
                <div className="v11-a5-pill">Upcoming</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ACT 6 · stamp · the message ──────────────────────────────── */}
      <section className="v11-a6">
        <h2 className="v11-a6-h">
          Talk to <em>qualified buyers.</em>
          <br />
          Not info-shoppers.
        </h2>
        <div className="v11-a6-mark">That&apos;s MedPay.</div>
      </section>

      <Cta label="Book a 15-min demo" ctaDelay={15.9} disclDelay={16.3} />
    </VideoStage>
  );
}
