/**
 * Video ad V7 — "LIVE · Cases funded this hour"  ·  15s  ·  1080×1920
 *
 * Live-feed FOMO — scrolling tickertape of fake-but-real-feeling funded
 * cases with timestamps + totals climbing. Designed to feel like a
 * trading-floor "this is happening right now."
 *
 *  0.0–0.8   stage in
 *  0.8–2.5   "LIVE · cases funded this hour" title with pulsing red dot
 *  2.5–11.0  feed rows stream in (12 rows total, every ~0.7s)
 * 11.0–12.5  total counter ticks up to "$847,200 · last hour"
 * 12.5–14.0  "While you read this, 4 practices joined" FOMO line
 * 14.0–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

const FEED: Array<{ time: string; doc: string; amt: string; tier: string }> = [
  { time: '4:38 PM', doc: 'Dr. M · Helio Dental', amt: '$14,200', tier: 'A' },
  { time: '4:31 PM', doc: 'Dr. R · Lumen Aesthetics', amt: '$18,500', tier: 'A' },
  { time: '4:26 PM', doc: 'Dr. S · Cedar Vet Clinic', amt: '$8,400', tier: 'B' },
  { time: '4:19 PM', doc: 'Dr. K · Pacific Vision', amt: '$11,200', tier: 'B' },
  { time: '4:14 PM', doc: 'Dr. M · Helio Dental', amt: '$22,800', tier: 'A' },
  { time: '4:09 PM', doc: 'Dr. T · Aurora Med Spa', amt: '$6,500', tier: 'B' },
  { time: '4:02 PM', doc: 'Dr. L · Ridge Dermatology', amt: '$15,800', tier: 'A' },
  { time: '3:58 PM', doc: 'Dr. B · North Bay Smiles', amt: '$9,300', tier: 'B' },
  { time: '3:51 PM', doc: 'Dr. G · Bayview Dental', amt: '$24,600', tier: 'A' },
  { time: '3:46 PM', doc: 'Dr. P · Verde Aesthetics', amt: '$12,100', tier: 'A' },
  { time: '3:40 PM', doc: 'Dr. W · Coastline Vision', amt: '$7,200', tier: 'B' },
  { time: '3:34 PM', doc: 'Dr. F · Meadow Vet', amt: '$13,400', tier: 'A' },
];

export default function MedPayVideoV7(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        .v7-title-wrap {
          position: absolute;
          top: 240px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.6s 0.8s forwards;
        }
        .v7-live {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 10px 20px;
          background: rgba(239, 68, 68, 0.18);
          border: 1px solid rgba(239, 68, 68, 0.55);
          border-radius: 999px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          letter-spacing: 0.3em;
          font-weight: 700;
          color: #fca5a5;
          text-transform: uppercase;
        }
        .v7-live-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #ef4444;
          animation: v7-blink 1.2s ease-in-out infinite;
        }
        @keyframes v7-blink {
          0%,
          100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55);
          }
          50% {
            opacity: 0.6;
            box-shadow: 0 0 0 14px rgba(239, 68, 68, 0);
          }
        }
        .v7-h {
          margin-top: 24px;
          font-size: 72px;
          font-weight: 800;
          letter-spacing: -0.034em;
          line-height: 1.04;
          color: #fff;
        }
        .v7-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* feed */
        .v7-feed {
          position: absolute;
          top: 540px;
          left: 64px;
          right: 64px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .v7-row {
          display: grid;
          grid-template-columns: 130px 1fr 200px 60px;
          gap: 18px;
          align-items: center;
          padding: 18px 22px;
          background:
            radial-gradient(ellipse 80% 100% at 0% 0%, rgba(34, 184, 160, 0.12), transparent 65%),
            rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(34, 184, 160, 0.28);
          border-radius: 14px;
          backdrop-filter: blur(14px);
          opacity: 0;
        }
        .v7-row-1 {
          animation: v7-row-in 0.35s 2.5s forwards;
        }
        .v7-row-2 {
          animation: v7-row-in 0.35s 3s forwards;
        }
        .v7-row-3 {
          animation: v7-row-in 0.35s 3.5s forwards;
        }
        .v7-row-4 {
          animation: v7-row-in 0.35s 4s forwards;
        }
        .v7-row-5 {
          animation: v7-row-in 0.35s 4.5s forwards;
        }
        .v7-row-6 {
          animation: v7-row-in 0.35s 5s forwards;
        }
        .v7-row-7 {
          animation: v7-row-in 0.35s 5.5s forwards;
        }
        .v7-row-8 {
          animation: v7-row-in 0.35s 6s forwards;
        }
        .v7-row-9 {
          animation: v7-row-in 0.35s 6.5s forwards;
        }
        .v7-row-10 {
          animation: v7-row-in 0.35s 7s forwards;
        }
        .v7-row-11 {
          animation: v7-row-in 0.35s 7.5s forwards;
        }
        .v7-row-12 {
          animation: v7-row-in 0.35s 8s forwards;
        }
        @keyframes v7-row-in {
          0% {
            opacity: 0;
            transform: translateY(20px);
            background-color: rgba(34, 184, 160, 0.32);
          }
          70% {
            background-color: rgba(34, 184, 160, 0.32);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .v7-time {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.62);
          letter-spacing: 0.04em;
        }
        .v7-doc {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.012em;
        }
        .v7-amt {
          font-size: 24px;
          font-weight: 800;
          color: ${TEAL_2};
          font-variant-numeric: tabular-nums;
          text-align: right;
        }
        .v7-tier {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: ${TEAL_2};
          background: rgba(34, 184, 160, 0.18);
          padding: 4px 9px;
          border-radius: 6px;
          text-align: center;
        }

        /* total counter */
        .v7-total {
          position: absolute;
          top: 1480px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-num-in 0.7s 11s forwards;
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
        .v7-total-amt {
          font-size: 140px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: #fff;
          text-shadow: 0 0 60px rgba(34, 184, 160, 0.55);
          font-variant-numeric: tabular-nums;
        }
        .v7-total-amt em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v7-total-sub {
          margin-top: 14px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 20px;
          letter-spacing: 0.3em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }

        .v7-fomo {
          position: absolute;
          top: 1720px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 32px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.78);
          opacity: 0;
          animation: vs-in-up 0.55s 12.6s forwards;
        }
        .v7-fomo em {
          font-style: normal;
          color: ${TEAL_2};
          font-weight: 800;
        }
      `}
    >
      <Mark />
      <Tag>Social proof · live feed</Tag>

      <div className="v7-title-wrap">
        <span className="v7-live">
          <span className="v7-live-dot" />
          Live · last hour
        </span>
        <h1 className="v7-h">
          Cases funded <em>right now.</em>
        </h1>
      </div>

      <div className="v7-feed">
        {FEED.map((r, i) => (
          <div key={i} className={`v7-row v7-row-${i + 1}`}>
            <span className="v7-time">{r.time}</span>
            <span className="v7-doc">{r.doc}</span>
            <span className="v7-amt">{r.amt}</span>
            <span className="v7-tier">Tier {r.tier}</span>
          </div>
        ))}
      </div>

      <div className="v7-total">
        <div className="v7-total-amt">$847,200</div>
        <div className="v7-total-sub">funded · last hour · MedPay</div>
      </div>

      <div className="v7-fomo">
        While you read this, <em>4 more practices joined.</em>
      </div>

      <Cta label="Be in the feed" ctaDelay={13.4} disclDelay={13.8} />
    </VideoStage>
  );
}
