/**
 * Video ad V9 — "The 4 questions that fund the case"  ·  15s  ·  1080×1920
 *
 * Educational / tutorial hook. Walks through the 4 fields a treatment
 * coordinator should hand-off the tablet for. Each Q + A flips in
 * rapid-fire, then the result card lands.
 *
 *  0.0–0.8   stage in
 *  0.8–2.0   eyebrow + headline "The 4 questions"
 *  2.0–3.5   Q1 + A1 typing in
 *  3.5–5.0   Q2 + A2
 *  5.0–6.5   Q3 + A3
 *  6.5–8.0   Q4 + A4
 *  8.0–10.0  results card slides up
 * 10.0–12.0  3 approval rails
 * 12.0–13.5  "Funded · same visit" stamp
 * 13.5–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV9(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        .v9-title-wrap {
          position: absolute;
          top: 220px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.6s 0.8s forwards;
        }
        .v9-eyebrow {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v9-h {
          margin-top: 14px;
          font-size: 84px;
          font-weight: 800;
          letter-spacing: -0.036em;
          line-height: 1.04;
          color: #fff;
        }
        .v9-h em {
          font-style: normal;
          color: ${TEAL_2};
        }

        /* Q&A cards */
        .v9-qa {
          position: absolute;
          top: 540px;
          left: 64px;
          right: 64px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .v9-q {
          padding: 22px 28px;
          background:
            radial-gradient(ellipse 80% 100% at 0% 0%, rgba(34, 184, 160, 0.18), transparent 65%),
            rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(34, 184, 160, 0.34);
          border-radius: 18px;
          backdrop-filter: blur(14px);
          display: grid;
          grid-template-columns: 60px 1fr;
          gap: 22px;
          align-items: center;
          opacity: 0;
        }
        .v9-q-1 {
          animation:
            vs-q-in 0.5s 2s forwards,
            vs-q-fade 0.5s 7.8s forwards;
        }
        .v9-q-2 {
          animation:
            vs-q-in 0.5s 3.5s forwards,
            vs-q-fade 0.5s 7.8s forwards;
        }
        .v9-q-3 {
          animation:
            vs-q-in 0.5s 5s forwards,
            vs-q-fade 0.5s 7.8s forwards;
        }
        .v9-q-4 {
          animation:
            vs-q-in 0.5s 6.5s forwards,
            vs-q-fade 0.5s 7.8s forwards;
        }
        @keyframes vs-q-in {
          0% {
            opacity: 0;
            transform: translateX(-30px);
            background-color: rgba(34, 184, 160, 0.35);
          }
          70% {
            background-color: rgba(34, 184, 160, 0.35);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes vs-q-fade {
          to {
            opacity: 0;
            filter: blur(8px);
          }
        }
        .v9-q-n {
          width: 60px;
          height: 60px;
          border-radius: 14px;
          background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
          color: #fff;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .v9-q-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .v9-q-prompt {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.62);
          font-weight: 600;
        }
        .v9-q-answer {
          font-size: 36px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.018em;
          font-variant-numeric: tabular-nums;
        }

        /* result card */
        .v9-result {
          position: absolute;
          top: 540px;
          left: 64px;
          right: 64px;
          padding: 32px;
          border-radius: 28px;
          background:
            radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.28), transparent 65%),
            rgba(34, 184, 160, 0.1);
          border: 1px solid rgba(34, 184, 160, 0.55);
          box-shadow: 0 50px 100px -20px rgba(34, 184, 160, 0.45);
          backdrop-filter: blur(18px);
          opacity: 0;
          animation: vs-card-in 0.6s 8s forwards;
        }
        @keyframes vs-card-in {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .v9-result-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 15px;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v9-result-name {
          margin-top: 10px;
          font-size: 56px;
          font-weight: 800;
          letter-spacing: -0.024em;
          color: #fff;
        }
        .v9-rails {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .v9-rail {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 22px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          font-size: 24px;
          opacity: 0;
        }
        .v9-rail-1 {
          animation: vs-rail-in 0.4s 9.8s forwards;
        }
        .v9-rail-2 {
          animation: vs-rail-in 0.4s 10.3s forwards;
        }
        .v9-rail-3 {
          animation: vs-rail-in 0.4s 10.8s forwards;
        }
        @keyframes vs-rail-in {
          0% {
            opacity: 0;
            transform: translateX(-30px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .v9-rail-l {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          color: #fff;
          font-weight: 700;
        }
        .v9-rail-c {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          background: rgba(34, 184, 160, 0.4);
          color: ${TEAL_2};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }
        .v9-rail-amt {
          color: ${TEAL_2};
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          font-size: 28px;
        }

        .v9-stamp {
          position: absolute;
          top: 1380px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 76px;
          font-weight: 800;
          letter-spacing: -0.032em;
          color: #fff;
          opacity: 0;
          animation: vs-stamp-in 0.55s 12s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
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
        .v9-stamp em {
          font-style: normal;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>Tutorial · educational</Tag>

      <div className="v9-title-wrap">
        <div className="v9-eyebrow">The conversation</div>
        <div className="v9-h">
          4 questions that <em>fund the case.</em>
        </div>
      </div>

      <div className="v9-qa">
        <div className="v9-q v9-q-1">
          <span className="v9-q-n">01</span>
          <div className="v9-q-text">
            <span className="v9-q-prompt">Treatment budget?</span>
            <span className="v9-q-answer">$15,000</span>
          </div>
        </div>
        <div className="v9-q v9-q-2">
          <span className="v9-q-n">02</span>
          <div className="v9-q-text">
            <span className="v9-q-prompt">Email?</span>
            <span className="v9-q-answer">jordan@example.com</span>
          </div>
        </div>
        <div className="v9-q v9-q-3">
          <span className="v9-q-n">03</span>
          <div className="v9-q-text">
            <span className="v9-q-prompt">Date of birth?</span>
            <span className="v9-q-answer">04 / 12 / 1985</span>
          </div>
        </div>
        <div className="v9-q v9-q-4">
          <span className="v9-q-n">04</span>
          <div className="v9-q-text">
            <span className="v9-q-prompt">Last 4 of SSN?</span>
            <span className="v9-q-answer">••••</span>
          </div>
        </div>
      </div>

      <div className="v9-result">
        <div className="v9-result-tag">Pre-qualified · 3 rails approved</div>
        <div className="v9-result-name">Jordan M. · Tier A</div>
        <div className="v9-rails">
          <div className="v9-rail v9-rail-1">
            <span className="v9-rail-l">
              <span className="v9-rail-c">✓</span> Consumer-direct
            </span>
            <span className="v9-rail-amt">$14,200</span>
          </div>
          <div className="v9-rail v9-rail-2">
            <span className="v9-rail-l">
              <span className="v9-rail-c">✓</span> Merchant-direct
            </span>
            <span className="v9-rail-amt">$18,500</span>
          </div>
          <div className="v9-rail v9-rail-3">
            <span className="v9-rail-l">
              <span className="v9-rail-c">✓</span> BNPL
            </span>
            <span className="v9-rail-amt">$5,000</span>
          </div>
        </div>
      </div>

      <div className="v9-stamp">
        Funded · <em>same visit.</em>
      </div>

      <Cta label="See the script" ctaDelay={13.5} disclDelay={13.9} />
    </VideoStage>
  );
}
