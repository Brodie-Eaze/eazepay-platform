/**
 * Video ad V11 v4 — "Two ways to run your clinic" · 25s · 1080×1920
 *
 * Practice-owner POV Facebook ad. Stops the scroll, shows we understand
 * their current funnel, then shows the MedPay funnel as the contrast.
 * NO invented dollar amounts. NO named AI agents. Just the actual product:
 * smart form → smart routing → qualified buyer → consult/sales call →
 * lender marketplace → funded. Each beat held 3–4s so the viewer can read.
 *
 *    0.0–3.0   HOOK   · "Practice owner — there are two ways to run your clinic"
 *    3.0–4.0   TAG    · "Here's how most do it today —"
 *    4.0–10.0  TODAY  · the current funnel (lead → dials → unqualified → wasted)
 *   10.0–11.0  PIVOT  · "Now here's MedPay —"
 *   11.0–18.0  MEDPAY · smart form → smart routing → qualified → call → lender → funded
 *   18.0–20.0  RESULT · "Qualified buyers. Booked calls. Funded same day."
 *   20.0–22.0  STAMP  · "That's MedPay."
 *   22.0–25.0  CTA + compliance
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

        /* ─── ACT 5 · MEDPAY funnel (11–18s) ───────────────────────────── */
        .v11-a5 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 11.1s forwards,
            vs-fade-out 0.5s 17.9s forwards;
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
        .v11-a5-steps {
          position: absolute;
          top: 420px;
          left: 60px;
          right: 60px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .v11-a5-step {
          display: grid;
          grid-template-columns: 64px 1fr;
          gap: 22px;
          align-items: center;
          padding: 18px 24px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(34, 184, 160, 0.3);
          border-radius: 18px;
          opacity: 0;
        }
        .v11-a5-step:nth-child(1) {
          animation: v11-pop-in 0.45s 11.5s forwards;
        }
        .v11-a5-step:nth-child(2) {
          animation: v11-pop-in 0.45s 12.3s forwards;
        }
        .v11-a5-step:nth-child(3) {
          animation: v11-pop-in 0.45s 13.1s forwards;
        }
        .v11-a5-step:nth-child(4) {
          animation: v11-pop-in 0.45s 13.9s forwards;
        }
        .v11-a5-step:nth-child(5) {
          animation: v11-pop-in 0.45s 14.7s forwards;
        }
        .v11-a5-step:nth-child(6) {
          animation: v11-pop-in 0.45s 15.5s forwards;
        }
        .v11-a5-num {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.01em;
        }
        .v11-a5-body {
          display: flex;
          flex-direction: column;
        }
        .v11-a5-h2 {
          font-size: 30px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.018em;
          line-height: 1.15;
        }
        .v11-a5-h2 em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v11-a5-b {
          margin-top: 4px;
          font-size: 18px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.3;
        }
        .v11-a5-tally {
          position: absolute;
          bottom: 100px;
          left: 60px;
          right: 60px;
          text-align: center;
          padding: 26px 28px;
          background: linear-gradient(135deg, rgba(14, 124, 102, 0.45), rgba(34, 184, 160, 0.22));
          border: 1px solid rgba(34, 184, 160, 0.65);
          border-radius: 20px;
          opacity: 0;
          animation: v11-pop-in 0.5s 16.5s forwards;
        }
        .v11-a5-tally-h {
          font-size: 38px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.022em;
          line-height: 1.15;
        }
        .v11-a5-tally-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* ─── ACT 6 · result (18–20s) ──────────────────────────────────── */
        .v11-a6 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation:
            vs-in-up 0.5s 18.1s forwards,
            vs-fade-out 0.4s 19.9s forwards;
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

        /* ─── ACT 7 · stamp (20–22s) ───────────────────────────────────── */
        .v11-a7 {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation: v11-blur-in 0.6s 20s forwards;
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

      {/* ─── ACT 5 · MEDPAY funnel ────────────────────────────────────── */}
      <section className="v11-a5">
        <div className="v11-a5-tag">The MedPay way</div>
        <h3 className="v11-a5-h">One ecosystem. Lead to funded.</h3>
        <div className="v11-a5-steps">
          <div className="v11-a5-step">
            <div className="v11-a5-num">1</div>
            <div className="v11-a5-body">
              <div className="v11-a5-h2">
                Lead fills your <em>smart form.</em>
              </div>
              <div className="v11-a5-b">Same form. We pull the financial picture.</div>
            </div>
          </div>
          <div className="v11-a5-step">
            <div className="v11-a5-num">2</div>
            <div className="v11-a5-body">
              <div className="v11-a5-h2">
                <em>Smart routing</em> qualifies them.
              </div>
              <div className="v11-a5-b">
                Soft-pull · credit · budget · tier. Zero credit impact.
              </div>
            </div>
          </div>
          <div className="v11-a5-step">
            <div className="v11-a5-num">3</div>
            <div className="v11-a5-body">
              <div className="v11-a5-h2">
                They&apos;re now a <em>qualified buyer.</em>
              </div>
              <div className="v11-a5-b">Pre-approved budget attached.</div>
            </div>
          </div>
          <div className="v11-a5-step">
            <div className="v11-a5-num">4</div>
            <div className="v11-a5-body">
              <div className="v11-a5-h2">
                Books a <em>consultation or sales call.</em>
              </div>
              <div className="v11-a5-b">Your closer only talks to buyers who can pay.</div>
            </div>
          </div>
          <div className="v11-a5-step">
            <div className="v11-a5-num">5</div>
            <div className="v11-a5-body">
              <div className="v11-a5-h2">
                <em>Lender marketplace</em> · instant decision.
              </div>
              <div className="v11-a5-b">One application. Multiple lenders. Best terms picked.</div>
            </div>
          </div>
          <div className="v11-a5-step">
            <div className="v11-a5-num">6</div>
            <div className="v11-a5-body">
              <div className="v11-a5-h2">
                <em>Funded.</em> Same day.
              </div>
              <div className="v11-a5-b">Patient on calendar. Lender wires you. Done.</div>
            </div>
          </div>
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

      <Cta label="Book a 15-min walkthrough" ctaDelay={22.2} disclDelay={22.6} />
    </VideoStage>
  );
}
