/**
 * Video ad V8 — "I wish I'd known this 6 months ago"  ·  15s  ·  1080×1920
 *
 * Testimonial-style hook with a (fictional but realistic) practice
 * profile. Designed to feel like an LP testimonial card on autoplay.
 *
 *  0.0–0.8   stage in
 *  0.8–3.5   pull-quote (huge) lands letter-by-letter
 *  3.5–5.5   attribution card slides in (Dr. + practice)
 *  5.5–9.0   before / after stat tiles flip in
 *  9.0–11.5  big number "$118k recovered Q1" lands
 * 11.5–13.5  closing line "Don't wait 6 months."
 * 13.5–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV8(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        .v8-quote {
          position: absolute;
          top: 380px;
          left: 64px;
          right: 64px;
          font-size: 80px;
          font-weight: 800;
          letter-spacing: -0.034em;
          line-height: 1.06;
          color: #fff;
          text-shadow: 0 0 50px rgba(34, 184, 160, 0.3);
          opacity: 0;
          filter: blur(20px);
          animation: vs-num-in 0.8s 0.8s forwards;
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
        .v8-quote em {
          font-style: normal;
          background: linear-gradient(135deg, ${TEAL_2}, #fff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .v8-quote-mark {
          color: ${TEAL_2};
          font-size: 120px;
          line-height: 0.5;
          margin-right: 6px;
        }

        .v8-attrib {
          position: absolute;
          top: 760px;
          left: 64px;
          right: 64px;
          padding: 28px 32px;
          background:
            radial-gradient(ellipse 80% 100% at 0% 0%, rgba(34, 184, 160, 0.18), transparent 65%),
            rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(34, 184, 160, 0.4);
          border-radius: 20px;
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 22px;
          align-items: center;
          backdrop-filter: blur(14px);
          opacity: 0;
          animation: vs-card-in 0.6s 3.5s forwards;
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
        .v8-avatar {
          width: 90px;
          height: 90px;
          border-radius: 24px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .v8-attrib-name {
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.018em;
        }
        .v8-attrib-meta {
          margin-top: 4px;
          font-size: 18px;
          color: rgba(255, 255, 255, 0.62);
        }

        /* before / after tiles */
        .v8-tiles {
          position: absolute;
          top: 970px;
          left: 64px;
          right: 64px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        .v8-tile {
          padding: 28px 24px;
          border-radius: 22px;
          opacity: 0;
        }
        .v8-tile-before {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.14);
          animation: vs-in-up 0.5s 5.6s forwards;
        }
        .v8-tile-after {
          background:
            radial-gradient(ellipse 80% 100% at 0% 0%, rgba(34, 184, 160, 0.25), transparent 65%),
            rgba(34, 184, 160, 0.1);
          border: 1px solid rgba(34, 184, 160, 0.5);
          box-shadow: 0 30px 60px -16px rgba(34, 184, 160, 0.4);
          animation: vs-in-up 0.5s 6.4s forwards;
        }
        .v8-tile-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 13px;
          letter-spacing: 0.22em;
          font-weight: 700;
          text-transform: uppercase;
        }
        .v8-tile-before .v8-tile-tag {
          color: rgba(255, 255, 255, 0.55);
        }
        .v8-tile-after .v8-tile-tag {
          color: ${TEAL_2};
        }
        .v8-tile-num {
          margin-top: 8px;
          font-size: 96px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .v8-tile-before .v8-tile-num {
          color: rgba(255, 255, 255, 0.55);
        }
        .v8-tile-after .v8-tile-num {
          color: #fff;
        }
        .v8-tile-sub {
          margin-top: 8px;
          font-size: 18px;
          line-height: 1.4;
        }
        .v8-tile-before .v8-tile-sub {
          color: rgba(255, 255, 255, 0.55);
        }
        .v8-tile-after .v8-tile-sub {
          color: rgba(255, 255, 255, 0.78);
        }

        .v8-headline-num {
          position: absolute;
          top: 1300px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-num-in 0.8s 9s forwards;
        }
        .v8-headline-num-amt {
          font-size: 200px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: #fff;
          text-shadow: 0 0 70px rgba(34, 184, 160, 0.55);
          font-variant-numeric: tabular-nums;
        }
        .v8-headline-num-amt em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v8-headline-num-sub {
          margin-top: 14px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }

        .v8-close {
          position: absolute;
          top: 1660px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 52px;
          font-weight: 800;
          letter-spacing: -0.026em;
          color: #fff;
          opacity: 0;
          animation: vs-stamp-in 0.55s 11.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
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
        .v8-close em {
          font-style: normal;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>Testimonial · regret</Tag>

      <div className="v8-quote">
        <span className="v8-quote-mark">&ldquo;</span>I wish I&apos;d known this{' '}
        <em>6 months ago.</em>
      </div>

      <div className="v8-attrib">
        <div className="v8-avatar">MK</div>
        <div>
          <div className="v8-attrib-name">Dr. Marcus K.</div>
          <div className="v8-attrib-meta">Helio Dental · 3 chairs · Austin TX</div>
        </div>
      </div>

      <div className="v8-tiles">
        <article className="v8-tile v8-tile-before">
          <div className="v8-tile-tag">Before MedPay</div>
          <div className="v8-tile-num">4</div>
          <div className="v8-tile-sub">cases / month · $36k</div>
        </article>
        <article className="v8-tile v8-tile-after">
          <div className="v8-tile-tag">After MedPay</div>
          <div className="v8-tile-num">14</div>
          <div className="v8-tile-sub">cases / month · $154k</div>
        </article>
      </div>

      <div className="v8-headline-num">
        <div className="v8-headline-num-amt">+$118k</div>
        <div className="v8-headline-num-sub">recovered · Q1 alone</div>
      </div>

      <div className="v8-close">
        Don&apos;t wait <em>6 months.</em>
      </div>

      <Cta label="See your projection" ctaDelay={13.2} disclDelay={13.6} />
    </VideoStage>
  );
}
