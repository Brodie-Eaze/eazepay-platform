/**
 * Video ad V10 — "While you slept..."  ·  15s  ·  1080×1920
 *
 * Late-night FOMO. Quiet open, then a counter ticks up + an overnight
 * funded-cases feed scrolls. Designed for ad-stack retargeting layer.
 *
 *  0.0–1.0   stage in: quiet dark backdrop
 *  1.0–3.0   "Last night, while you slept..." pull-quote (slow)
 *  3.0–7.0   counter ticks 0 → 47 practices · $890,000 funded
 *  7.0–11.0  overnight feed scrolls (5 rows, timestamps 11:42 PM → 4:23 AM)
 * 11.0–13.0  "Patients don't wait for business hours."
 * 13.0–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

const OVERNIGHT: Array<{ time: string; doc: string; amt: string }> = [
  { time: '04:23 AM', doc: 'Dr. M · Helio Dental', amt: '$14,200' },
  { time: '02:17 AM', doc: 'Dr. R · Lumen Aesthetics', amt: '$22,800' },
  { time: '12:48 AM', doc: 'Dr. S · Cedar Vet', amt: '$8,400' },
  { time: '11:42 PM', doc: 'Dr. K · Pacific Vision', amt: '$18,500' },
  { time: '11:09 PM', doc: 'Dr. T · Aurora Med Spa', amt: '$11,200' },
];

export default function MedPayVideoV10(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        /* override the bright stage glow with a quieter night-mode backdrop */
        .vs-canvas {
          background:
            radial-gradient(
              ellipse 60% 50% at 20% 10%,
              rgba(34, 184, 160, 0.16) 0%,
              transparent 60%
            ),
            radial-gradient(
              ellipse 50% 60% at 85% 90%,
              rgba(14, 124, 102, 0.22) 0%,
              transparent 55%
            ),
            linear-gradient(180deg, #020a0c 0%, #010606 100%);
        }

        /* faint star field */
        .v10-stars {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.45) 0.5px, transparent 1.5px),
            radial-gradient(circle at 70% 25%, rgba(255, 255, 255, 0.35) 0.5px, transparent 1.5px),
            radial-gradient(circle at 35% 70%, rgba(255, 255, 255, 0.3) 0.5px, transparent 1.5px),
            radial-gradient(circle at 85% 60%, rgba(255, 255, 255, 0.4) 0.5px, transparent 1.5px),
            radial-gradient(circle at 50% 85%, rgba(255, 255, 255, 0.3) 0.5px, transparent 1.5px),
            radial-gradient(circle at 12% 50%, rgba(255, 255, 255, 0.25) 0.5px, transparent 1.5px),
            radial-gradient(circle at 90% 12%, rgba(255, 255, 255, 0.4) 0.5px, transparent 1.5px);
          background-size: 600px 600px;
          opacity: 0.6;
          pointer-events: none;
        }

        .v10-eyebrow {
          position: absolute;
          top: 240px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation: vs-in-up 0.6s 1s forwards;
        }

        .v10-quote {
          position: absolute;
          top: 320px;
          left: 64px;
          right: 64px;
          text-align: center;
          font-size: 80px;
          font-weight: 800;
          letter-spacing: -0.034em;
          line-height: 1.04;
          color: #fff;
          opacity: 0;
          filter: blur(20px);
          animation: vs-num-in 0.9s 1.2s forwards;
        }
        @keyframes vs-num-in {
          0% {
            opacity: 0;
            filter: blur(20px);
            transform: scale(1.04);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
          }
        }
        .v10-quote em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* counter */
        .v10-counter {
          position: absolute;
          top: 620px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-num-in 0.8s 3s forwards;
        }
        .v10-counter-num {
          font-size: 180px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: #fff;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 70px rgba(34, 184, 160, 0.55);
        }
        .v10-counter-num em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v10-counter-sub {
          margin-top: 12px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v10-counter-amt {
          margin-top: 24px;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.034em;
          color: #fff;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.45);
        }
        .v10-counter-amt em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v10-counter-amt-sub {
          margin-top: 6px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          letter-spacing: 0.3em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.55);
          text-transform: uppercase;
        }

        /* overnight feed */
        .v10-feed-title {
          position: absolute;
          top: 1180px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          letter-spacing: 0.3em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
          opacity: 0;
          animation: vs-in-up 0.5s 6.5s forwards;
        }
        .v10-feed {
          position: absolute;
          top: 1230px;
          left: 64px;
          right: 64px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .v10-row {
          display: grid;
          grid-template-columns: 150px 1fr 180px;
          gap: 18px;
          align-items: center;
          padding: 14px 22px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(34, 184, 160, 0.22);
          border-radius: 12px;
          backdrop-filter: blur(14px);
          opacity: 0;
        }
        .v10-row-1 {
          animation: vs-row-in 0.4s 7s forwards;
        }
        .v10-row-2 {
          animation: vs-row-in 0.4s 7.5s forwards;
        }
        .v10-row-3 {
          animation: vs-row-in 0.4s 8s forwards;
        }
        .v10-row-4 {
          animation: vs-row-in 0.4s 8.5s forwards;
        }
        .v10-row-5 {
          animation: vs-row-in 0.4s 9s forwards;
        }
        @keyframes vs-row-in {
          0% {
            opacity: 0;
            transform: translateY(16px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .v10-row-time {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.62);
        }
        .v10-row-doc {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.012em;
        }
        .v10-row-amt {
          font-size: 24px;
          font-weight: 800;
          color: ${TEAL_2};
          font-variant-numeric: tabular-nums;
          text-align: right;
        }

        .v10-close {
          position: absolute;
          top: 1660px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 52px;
          font-weight: 800;
          letter-spacing: -0.026em;
          line-height: 1.18;
          color: #fff;
          opacity: 0;
          animation: vs-num-in 0.7s 11s forwards;
        }
        .v10-close em {
          font-style: normal;
          color: ${TEAL_2};
        }
      `}
    >
      <div className="v10-stars" aria-hidden />
      <Mark />
      <Tag>Overnight · retarget</Tag>

      <div className="v10-eyebrow">Last night</div>
      <div className="v10-quote">
        While you <em>slept…</em>
      </div>

      <div className="v10-counter">
        <div className="v10-counter-num">
          47<em>+</em>
        </div>
        <div className="v10-counter-sub">practices funded cases</div>
        <div className="v10-counter-amt">$890,000</div>
        <div className="v10-counter-amt-sub">overnight · while closed</div>
      </div>

      <div className="v10-feed-title">Recent · last 6 hours</div>
      <div className="v10-feed">
        {OVERNIGHT.map((r, i) => (
          <div key={i} className={`v10-row v10-row-${i + 1}`}>
            <span className="v10-row-time">{r.time}</span>
            <span className="v10-row-doc">{r.doc}</span>
            <span className="v10-row-amt">{r.amt}</span>
          </div>
        ))}
      </div>

      <div className="v10-close">
        Patients don&apos;t wait for <em>business hours.</em>
      </div>

      <Cta label="Be open 24/7" ctaDelay={12.8} disclDelay={13.2} />
    </VideoStage>
  );
}
