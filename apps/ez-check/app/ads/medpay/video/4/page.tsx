/**
 * Video ad V4 — "Your competitor just closed her"  ·  15s  ·  1080×1920
 *
 * FOMO · the patient you let walk got funded next door. Split-screen
 * "your practice" (dim, empty chair) vs "practice next door" (bright,
 * patient signing).
 *
 *  0.0–0.8   stage in
 *  0.8–2.0   ominous tag + huge "THE PATIENT YOU LET WALK"
 *  2.0–4.0   LEFT panel: your practice — empty chair, "I'll think about it"
 *  4.0–6.5   RIGHT panel slides in: practice next door — patient seated, funded
 *  6.5–10.0  zoom on right: $14,200 funded card
 * 10.0–12.5  big text "She didn't think about it. She went where she didn't have to."
 * 12.5–14.0  FOMO stat: "2,400+ practices on MedPay · in your state"
 * 14.0–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV4(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        /* opening title */
        .v4-title {
          position: absolute;
          top: 230px;
          left: 64px;
          right: 64px;
          text-align: center;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.02;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.35);
          opacity: 0;
          filter: blur(20px);
          animation:
            vs-num-in 0.7s 0.9s forwards,
            vs-num-out 0.5s 9.6s forwards;
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
        .v4-title em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* split panels */
        .v4-panel {
          position: absolute;
          top: 600px;
          height: 800px;
          padding: 40px 36px;
          border-radius: 36px;
          overflow: hidden;
        }
        .v4-panel-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 16px;
          letter-spacing: 0.2em;
          font-weight: 700;
          text-transform: uppercase;
        }
        .v4-panel-h {
          margin-top: 14px;
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -0.022em;
          line-height: 1.1;
        }
        .v4-panel-quote {
          margin-top: 22px;
          font-size: 32px;
          font-weight: 700;
          line-height: 1.3;
        }

        /* LEFT: your practice (dim) */
        .v4-panel-yours {
          left: 64px;
          width: 460px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.55);
          opacity: 0;
          animation:
            vs-slide-l 0.6s 2s forwards,
            v4-dim 0.5s 6.5s forwards;
        }
        @keyframes vs-slide-l {
          0% {
            opacity: 0;
            transform: translateX(-60px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes v4-dim {
          to {
            opacity: 0.35;
            filter: blur(2px);
          }
        }
        .v4-panel-yours .v4-panel-tag {
          color: rgba(255, 255, 255, 0.5);
        }
        .v4-panel-yours .v4-panel-h {
          color: rgba(255, 255, 255, 0.78);
        }
        .v4-icon {
          margin-top: 36px;
          width: 160px;
          height: 160px;
          border: 4px dashed rgba(255, 255, 255, 0.18);
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 68px;
        }

        /* RIGHT: practice next door (bright) */
        .v4-panel-them {
          right: 64px;
          width: 460px;
          background:
            radial-gradient(ellipse 80% 100% at 0% 0%, rgba(34, 184, 160, 0.3), transparent 65%),
            rgba(34, 184, 160, 0.1);
          border: 1px solid rgba(34, 184, 160, 0.55);
          color: #fff;
          box-shadow: 0 50px 100px -20px rgba(34, 184, 160, 0.45);
          opacity: 0;
          animation: vs-slide-r 0.6s 3.6s forwards;
        }
        @keyframes vs-slide-r {
          0% {
            opacity: 0;
            transform: translateX(60px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .v4-panel-them .v4-panel-tag {
          color: ${TEAL_2};
        }
        .v4-funded {
          margin-top: 24px;
          padding: 18px 22px;
          background: rgba(34, 184, 160, 0.3);
          border: 1px solid rgba(34, 184, 160, 0.55);
          border-radius: 16px;
          opacity: 0;
          animation: vs-in-up 0.5s 6.5s forwards;
        }
        .v4-funded-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v4-funded-amt {
          margin-top: 4px;
          font-size: 56px;
          font-weight: 800;
          letter-spacing: -0.024em;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }
        .v4-funded-meta {
          margin-top: 4px;
          font-size: 18px;
          color: rgba(255, 255, 255, 0.78);
        }

        /* lower headline */
        .v4-lower {
          position: absolute;
          top: 700px;
          left: 64px;
          right: 64px;
          text-align: center;
          font-size: 60px;
          font-weight: 800;
          letter-spacing: -0.028em;
          line-height: 1.18;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.4);
          opacity: 0;
          animation:
            vs-num-in 0.7s 10s forwards,
            vs-num-out 0.5s 12.4s forwards;
        }
        .v4-lower em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* FOMO stat */
        .v4-stat {
          position: absolute;
          top: 1100px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-num-in 0.6s 12.4s forwards;
        }
        .v4-stat-num {
          font-size: 200px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: #fff;
          text-shadow: 0 0 70px rgba(34, 184, 160, 0.55);
          font-variant-numeric: tabular-nums;
        }
        .v4-stat-sub {
          margin-top: 18px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
      `}
    >
      <Mark />
      <Tag>FOMO · competitive</Tag>

      <div className="v4-title">
        The patient you let <em>walk.</em>
      </div>

      <article className="v4-panel v4-panel-yours">
        <div className="v4-panel-tag">Your practice</div>
        <h3 className="v4-panel-h">Empty chair · 4:12 PM</h3>
        <p className="v4-panel-quote">&ldquo;I&apos;ll think about it.&rdquo;</p>
        <div className="v4-icon" aria-hidden>
          ×
        </div>
      </article>

      <article className="v4-panel v4-panel-them">
        <div className="v4-panel-tag">Practice next door</div>
        <h3 className="v4-panel-h">Sarah M. · signed · 4:38 PM</h3>
        <p className="v4-panel-quote">&ldquo;$295/mo? Let&apos;s book.&rdquo;</p>
        <div className="v4-funded">
          <div className="v4-funded-tag">Funded · same hour</div>
          <div className="v4-funded-amt">$14,200</div>
          <div className="v4-funded-meta">Consumer-direct · Tier A · Pre-approved</div>
        </div>
      </article>

      <div className="v4-lower">
        She didn&apos;t think about it.
        <br />
        She went where she <em>didn&apos;t have to.</em>
      </div>

      <div className="v4-stat">
        <div className="v4-stat-num">2,400+</div>
        <div className="v4-stat-sub">practices on MedPay · in your state</div>
      </div>

      <Cta label="Stop losing patients" ctaDelay={13.6} disclDelay={14.0} />
    </VideoStage>
  );
}
