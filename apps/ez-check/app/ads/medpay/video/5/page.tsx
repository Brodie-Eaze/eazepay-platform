/**
 * Video ad V5 — "73% Don't Come Back"  ·  15s  ·  1080×1920
 *
 * Stat-reveal hook. Big "100%" ticks down to "27%" as red s crosses
 * "73 walked away." Then the MedPay flip: same patients, 70%+ close.
 *
 *  0.0–0.8   stage in
 *  0.8–2.0   "OF THE PATIENTS WHO SAID 'I'LL THINK ABOUT IT'..."
 *  2.0–4.5   100% number ticks down to 27% (counter animation)
 *  4.5–6.5   "73% never come back" big red s
 *  6.5–9.0   transition to: "MedPay practices: 70%+ close same-day"
 *  9.0–12.0  recovered case card flashes (proof)
 * 12.0–13.5  stamp "Close them before they leave."
 * 13.5–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV5(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        .v5-eyebrow {
          position: absolute;
          top: 260px;
          left: 64px;
          right: 64px;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation:
            vs-in-up 0.6s 0.9s forwards,
            vs-fade-out 0.5s 6.4s forwards;
          line-height: 1.4;
        }
        @keyframes vs-fade-out {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        /* the BIG 100% → 27% number with crossfading ticks */
        .v5-num-wrap {
          position: absolute;
          top: 480px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation:
            vs-num-in 0.7s 1.6s forwards,
            vs-num-out 0.5s 6.4s forwards;
          height: 280px;
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
          }
          100% {
            opacity: 0;
            filter: blur(16px);
          }
        }
        .v5-tick {
          position: absolute;
          left: 0;
          right: 0;
          font-size: 320px;
          font-weight: 800;
          letter-spacing: -0.045em;
          line-height: 1;
          color: #fff;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.4);
          opacity: 0;
        }
        .v5-tick.tA {
          animation:
            v5-tick-vis 0.4s 2s forwards,
            v5-tick-hide 0.3s 2.5s forwards;
        }
        .v5-tick.tB {
          animation:
            v5-tick-vis 0.4s 2.6s forwards,
            v5-tick-hide 0.3s 3.1s forwards;
        }
        .v5-tick.tC {
          animation:
            v5-tick-vis 0.4s 3.2s forwards,
            v5-tick-hide 0.3s 3.7s forwards;
        }
        .v5-tick.tD {
          animation:
            v5-tick-vis 0.4s 3.8s forwards,
            v5-tick-hide 0.3s 4.3s forwards;
        }
        .v5-tick.tE {
          animation: v5-tick-vis 0.4s 4.4s forwards;
          color: #fca5a5;
        }
        @keyframes v5-tick-vis {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes v5-tick-hide {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-20px);
          }
        }

        .v5-lost {
          position: absolute;
          top: 880px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.028em;
          line-height: 1.18;
          color: #fff;
          opacity: 0;
          animation:
            vs-in-up 0.6s 4.6s forwards,
            vs-fade-out 0.5s 6.4s forwards;
        }
        .v5-lost s {
          color: #fca5a5;
          text-decoration: line-through;
          text-decoration-thickness: 8px;
        }

        /* MedPay flip */
        .v5-flip {
          position: absolute;
          top: 480px;
          left: 64px;
          right: 64px;
          text-align: center;
          opacity: 0;
          animation: vs-num-in 0.7s 6.8s forwards;
        }
        .v5-flip-eyebrow {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          margin-bottom: 28px;
        }
        .v5-flip-num {
          font-size: 320px;
          font-weight: 800;
          letter-spacing: -0.045em;
          line-height: 1;
          color: #fff;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 70px rgba(34, 184, 160, 0.55);
        }
        .v5-flip-num em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v5-flip-sub {
          margin-top: 28px;
          font-size: 44px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.18;
          color: rgba(255, 255, 255, 0.92);
        }
        .v5-flip-sub em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* tiny proof card */
        .v5-proof {
          position: absolute;
          top: 1100px;
          left: 120px;
          right: 120px;
          padding: 24px 28px;
          border-radius: 22px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.25), transparent 65%),
            rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(34, 184, 160, 0.5);
          backdrop-filter: blur(18px);
          display: flex;
          justify-content: space-between;
          align-items: center;
          opacity: 0;
          animation: vs-card-in 0.6s 9.2s forwards;
        }
        @keyframes vs-card-in {
          0% {
            opacity: 0;
            transform: translateY(40px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .v5-proof-l {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .v5-proof-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v5-proof-h {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #fff;
        }
        .v5-proof-amt {
          font-size: 44px;
          font-weight: 800;
          color: ${TEAL_2};
          font-variant-numeric: tabular-nums;
        }

        .v5-stamp {
          position: absolute;
          top: 1340px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 56px;
          font-weight: 800;
          letter-spacing: -0.026em;
          color: #fff;
          opacity: 0;
          animation: vs-stamp-in 0.55s 11.6s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
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
        .v5-stamp em {
          font-style: normal;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>Stat reveal · FOMO</Tag>

      <div className="v5-eyebrow">
        Of patients who say
        <br />
        &ldquo;I&apos;ll think about it&rdquo;…
      </div>
      <div className="v5-num-wrap">
        <span className="v5-tick tA">100%</span>
        <span className="v5-tick tB">82%</span>
        <span className="v5-tick tC">61%</span>
        <span className="v5-tick tD">42%</span>
        <span className="v5-tick tE">27%</span>
      </div>
      <div className="v5-lost">
        <s>73%</s> never come back.
      </div>

      <div className="v5-flip">
        <div className="v5-flip-eyebrow">MedPay practices, same patient pool</div>
        <div className="v5-flip-num">
          70%<em>+</em>
        </div>
        <div className="v5-flip-sub">
          close <em>same-day.</em>
        </div>
      </div>

      <div className="v5-proof">
        <div className="v5-proof-l">
          <span className="v5-proof-tag">Recovered case · Tier A</span>
          <span className="v5-proof-h">Jordan M. · funded</span>
        </div>
        <span className="v5-proof-amt">$14,200</span>
      </div>

      <div className="v5-stamp">
        Close them <em>before they leave.</em>
      </div>

      <Cta label="See your numbers" ctaDelay={13.2} disclDelay={13.6} />
    </VideoStage>
  );
}
