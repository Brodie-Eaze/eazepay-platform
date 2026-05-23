/**
 * Video ad V11 v5 — "Two ways to run your clinic" + visual routing map · 28s · 1080×1920
 *
 * Practice-owner POV Facebook ad. Same old-funnel-vs-MedPay-funnel arc, but
 * the MedPay section now shows the actual visual map: a glowing orb travels
 * down the spine from Smart Form → Smart Routing (with dashed A/B branches
 * splaying off) → Qualified Buyer (hero node) → Sales Call → Lender
 * Marketplace → Funded. Each node lights up as the orb arrives.
 *
 *    0.0–3.0   HOOK   · "Practice owner — there are two ways to run your clinic"
 *    3.0–4.0   TAG    · "Here's how most do it today —"
 *    4.0–10.0  TODAY  · the current funnel (lead → dials → unqualified → wasted)
 *   10.0–11.0  PIVOT  · "Now here's MedPay —"
 *   11.0–20.0  MEDPAY · 6-node visual map with glowing orb traversing the spine
 *   20.0–22.0  RESULT · "Qualified buyers. Booked calls. Funded same day."
 *   22.0–24.0  STAMP  · "That's MedPay."
 *   24.0–28.0  CTA + compliance
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

        /* ─── ACT 1 · hook (0–3s) ──────────────────────────────────────── */
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
          top: 580px;
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
          top: 660px;
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

        /* ─── ACT 2 · tag (3–4s) ──────────────────────────────────────── */
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

        /* ─── ACT 3 · TODAY'S funnel (4.0–10s) ─────────────────────────── */
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
        .v11-a3-h em {
          font-style: normal;
          color: rgba(248, 113, 113, 0.95);
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
          grid-template-columns: 72px 1fr auto;
          gap: 22px;
          align-items: center;
          padding: 22px 26px;
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
        .v11-a3-icon {
          width: 72px;
          height: 72px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
        }
        .v11-a3-step.is-bad .v11-a3-icon {
          background: rgba(248, 113, 113, 0.14);
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

        /* ─── ACT 4 · pivot (10–11s) ───────────────────────────────────── */
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

        /* ─── ACT 5 · MEDPAY visual map (11–20s) ─────────────────────── */
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
          font-size: 60px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: #fff;
        }
        .v11-a5-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* the routing map · pipeline container */
        .v11-pipe {
          position: absolute;
          top: 420px;
          left: 70px;
          right: 70px;
          height: 880px;
        }

        /* solid vertical spine the orb follows */
        .v11-pipe-spine {
          position: absolute;
          left: 50%;
          margin-left: -2px;
          top: 70px;
          bottom: 70px;
          width: 4px;
          background: linear-gradient(
            180deg,
            rgba(34, 184, 160, 0.1) 0%,
            rgba(34, 184, 160, 0.5) 30%,
            rgba(34, 184, 160, 0.5) 70%,
            rgba(34, 184, 160, 0.1) 100%
          );
          border-radius: 2px;
        }

        /* dashed A/B branches splaying off Smart Routing node */
        .v11-pipe-branch {
          position: absolute;
          height: 2px;
          border-top: 2px dashed rgba(255, 255, 255, 0.2);
        }
        .v11-pipe-branch-left {
          top: 260px;
          right: 50%;
          width: 110px;
          margin-right: 10px;
        }
        .v11-pipe-branch-right {
          top: 260px;
          left: 50%;
          width: 110px;
          margin-left: 10px;
        }
        .v11-pipe-tier {
          position: absolute;
          top: 240px;
          padding: 4px 10px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.04);
          border: 1px dashed rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          opacity: 0;
          animation: v11-blur-in 0.5s 13.4s forwards;
        }
        .v11-pipe-tier.is-left {
          right: 50%;
          margin-right: 124px;
        }
        .v11-pipe-tier.is-right {
          left: 50%;
          margin-left: 124px;
        }

        /* each pipeline node */
        .v11-pipe-node {
          position: absolute;
          left: 0;
          right: 0;
          padding: 16px 20px;
          background: rgba(15, 23, 42, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          text-align: center;
          opacity: 0.28;
        }
        .v11-pipe-node-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.42);
        }
        .v11-pipe-node-h {
          margin-top: 4px;
          font-size: 26px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.018em;
          line-height: 1.1;
        }
        .v11-pipe-node-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* node positions */
        .v11-pipe-form {
          top: 0;
          animation: v11-node-lit 0.4s 12.2s forwards;
        }
        .v11-pipe-routing {
          top: 160px;
          animation: v11-node-lit 0.4s 13.4s forwards;
        }
        .v11-pipe-qual {
          top: 320px;
          padding: 22px 24px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.32), rgba(34, 184, 160, 0.16));
          border-color: rgba(34, 184, 160, 0.55);
          animation: v11-node-lit-hero 0.55s 14.7s forwards;
        }
        .v11-pipe-qual .v11-pipe-node-h {
          font-size: 32px;
        }
        .v11-pipe-call {
          top: 510px;
          animation: v11-node-lit 0.4s 15.9s forwards;
        }
        .v11-pipe-lender {
          top: 660px;
          animation: v11-node-lit 0.4s 17.1s forwards;
        }
        .v11-pipe-funded {
          top: 810px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.45), rgba(34, 184, 160, 0.22));
          border-color: rgba(34, 184, 160, 0.65);
          animation: v11-node-lit-terminal 0.5s 18.4s forwards;
        }
        .v11-pipe-funded .v11-pipe-node-h {
          font-size: 28px;
        }

        @keyframes v11-node-lit {
          0% {
            opacity: 0.28;
          }
          60% {
            opacity: 1;
            transform: scale(1.03);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            border-color: rgba(34, 184, 160, 0.65);
            box-shadow: 0 16px 40px -14px rgba(34, 184, 160, 0.55);
          }
        }
        @keyframes v11-node-lit-hero {
          0% {
            opacity: 0.28;
            transform: scale(1);
          }
          60% {
            opacity: 1;
            transform: scale(1.06);
          }
          100% {
            opacity: 1;
            transform: scale(1.02);
            border-color: rgba(34, 184, 160, 0.85);
            box-shadow: 0 24px 60px -16px rgba(34, 184, 160, 0.75);
          }
        }
        @keyframes v11-node-lit-terminal {
          0% {
            opacity: 0.28;
            transform: scale(1);
          }
          70% {
            opacity: 1;
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            border-color: rgba(34, 184, 160, 0.9);
            box-shadow: 0 20px 50px -14px rgba(34, 184, 160, 0.75);
          }
        }

        /* the glowing orb that travels the spine — Sarah's path */
        .v11-pipe-orb {
          position: absolute;
          left: 50%;
          margin-left: -14px;
          margin-top: -14px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: radial-gradient(
            circle at 35% 30%,
            #fff 0%,
            ${TEAL_2} 70%,
            rgba(34, 184, 160, 0.4) 100%
          );
          box-shadow:
            0 0 24px #fff,
            0 0 50px ${TEAL_2},
            0 0 100px rgba(34, 184, 160, 0.7);
          opacity: 0;
          top: -30px;
          animation: v11-orb-fall 7s 11.6s cubic-bezier(0.55, 0, 0.45, 1) forwards;
        }
        @keyframes v11-orb-fall {
          0% {
            top: -30px;
            opacity: 0;
          }
          4% {
            top: 36px;
            opacity: 1;
          } /* on Smart Form */
          22% {
            top: 196px;
            opacity: 1;
          } /* on Smart Routing */
          48% {
            top: 370px;
            opacity: 1;
          } /* on Qualified Buyer (hero) */
          66% {
            top: 546px;
            opacity: 1;
          } /* on Sales Call */
          84% {
            top: 696px;
            opacity: 1;
          } /* on Lender Marketplace */
          100% {
            top: 846px;
            opacity: 1;
          } /* on Funded */
        }

        .v11-a5-tally {
          position: absolute;
          bottom: 70px;
          left: 60px;
          right: 60px;
          text-align: center;
          padding: 22px 28px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.4), rgba(34, 184, 160, 0.2));
          border: 1px solid rgba(34, 184, 160, 0.55);
          border-radius: 20px;
          opacity: 0;
          animation: v11-pop-in 0.5s 18.8s forwards;
        }
        .v11-a5-tally-h {
          font-size: 36px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.022em;
          line-height: 1.15;
        }
        .v11-a5-tally-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ─── ACT 6 · result (20–22s) ──────────────────────────────────── */
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

        /* ─── ACT 7 · stamp (22–24s) ───────────────────────────────────── */
        .v11-a7 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation: v11-blur-in 0.6s 22s forwards;
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
      `}
    >
      <Mark />
      <Tag>MedPay · for practice owners</Tag>

      {/* ─── ACT 1 · hook ─────────────────────────────────────────────── */}
      <section className="v11-a1">
        <div className="v11-a1-pre">Practice owner —</div>
        <h1 className="v11-a1-h">
          there are <em>two ways</em> to run your clinic.
        </h1>
        <div className="v11-a1-sub">Let&apos;s look at both.</div>
      </section>

      {/* ─── ACT 2 · tag ──────────────────────────────────────────────── */}
      <section className="v11-a2">
        <h2 className="v11-a2-h">
          Here&apos;s how <em>most do it today</em> —
        </h2>
      </section>

      {/* ─── ACT 3 · TODAY'S funnel ───────────────────────────────────── */}
      <section className="v11-a3">
        <div className="v11-a3-tag">Today&apos;s funnel</div>
        <h3 className="v11-a3-h">Your day, every day.</h3>
        <div className="v11-a3-steps">
          <div className="v11-a3-step">
            <div className="v11-a3-icon">📝</div>
            <div className="v11-a3-body">
              <div className="v11-a3-h2">Lead fills your form.</div>
              <div className="v11-a3-b">Name, email, maybe a phone number.</div>
            </div>
            <div></div>
          </div>
          <div className="v11-a3-step is-bad">
            <div className="v11-a3-icon">📞</div>
            <div className="v11-a3-body">
              <div className="v11-a3-h2">Your closer dials every one.</div>
              <div className="v11-a3-b">No idea who can pay. Calls the whole list.</div>
            </div>
            <div className="v11-a3-pill">80 dials</div>
          </div>
          <div className="v11-a3-step is-bad">
            <div className="v11-a3-icon">💬</div>
            <div className="v11-a3-body">
              <div className="v11-a3-h2">Hours on unqualified buyers.</div>
              <div className="v11-a3-b">
                &ldquo;Just info.&rdquo; &ldquo;Can&apos;t afford.&rdquo; &ldquo;Maybe later.&rdquo;
              </div>
            </div>
            <div className="v11-a3-pill">~6 hrs</div>
          </div>
          <div className="v11-a3-step is-bad">
            <div className="v11-a3-icon">📉</div>
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

      {/* ─── ACT 4 · pivot ────────────────────────────────────────────── */}
      <section className="v11-a4">
        <h2 className="v11-a4-h">
          Now here&apos;s <em>MedPay</em> —
        </h2>
      </section>

      {/* ─── ACT 5 · MEDPAY visual map ────────────────────────────────── */}
      <section className="v11-a5">
        <div className="v11-a5-tag">The MedPay way</div>
        <h3 className="v11-a5-h">Watch a lead become a buyer.</h3>
        <div className="v11-pipe">
          {/* solid spine + the dashed A/B branches at the routing node */}
          <div className="v11-pipe-spine" />
          <div className="v11-pipe-branch v11-pipe-branch-left" />
          <div className="v11-pipe-branch v11-pipe-branch-right" />
          <div className="v11-pipe-tier is-left">Tier B/C</div>
          <div className="v11-pipe-tier is-right">Nurture</div>

          {/* 6 nodes the orb traverses */}
          <div className="v11-pipe-node v11-pipe-form">
            <div className="v11-pipe-node-k">01 · Lead capture</div>
            <div className="v11-pipe-node-h">Smart form</div>
          </div>

          <div className="v11-pipe-node v11-pipe-routing">
            <div className="v11-pipe-node-k">02 · Multi-hop</div>
            <div className="v11-pipe-node-h">
              Smart routing <em>· qualifies</em>
            </div>
          </div>

          <div className="v11-pipe-node v11-pipe-qual">
            <div className="v11-pipe-node-k">03 · Sarah · Tier A</div>
            <div className="v11-pipe-node-h">
              <em>Qualified buyer</em>
            </div>
          </div>

          <div className="v11-pipe-node v11-pipe-call">
            <div className="v11-pipe-node-k">04 · Calendar</div>
            <div className="v11-pipe-node-h">Consult or sales call</div>
          </div>

          <div className="v11-pipe-node v11-pipe-lender">
            <div className="v11-pipe-node-k">05 · 1 app · 5 lenders</div>
            <div className="v11-pipe-node-h">
              Lender marketplace <em>· instant</em>
            </div>
          </div>

          <div className="v11-pipe-node v11-pipe-funded">
            <div className="v11-pipe-node-k">06 · Same day</div>
            <div className="v11-pipe-node-h">
              <em>Funded.</em>
            </div>
          </div>

          {/* the glowing orb that traces Sarah's path */}
          <div className="v11-pipe-orb" />
        </div>
        <div className="v11-a5-tally">
          <div className="v11-a5-tally-h">
            One ecosystem. <em>Lead to funded.</em>
          </div>
        </div>
      </section>

      {/* ─── ACT 6 · result ───────────────────────────────────────────── */}
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

      {/* ─── ACT 7 · stamp ────────────────────────────────────────────── */}
      <section className="v11-a7">
        <div className="v11-a7-pre">That&apos;s</div>
        <h2 className="v11-a7-h">MedPay.</h2>
      </section>

      <Cta label="Book a 15-min walkthrough" ctaDelay={24.2} disclDelay={24.6} />
    </VideoStage>
  );
}
