/**
 * Video ad V6 — "Before MedPay / After MedPay · Tuesday at 5 PM"  ·  15s  ·  1080×1920
 *
 * Direct before/after split — same practice, same day, two outcomes.
 * Shows the gap in cases-closed, revenue-funded, follow-up calls owed.
 *
 *  0.0–0.8   stage in
 *  0.8–2.0   "TUESDAY · 5 PM" timestamp lands
 *  2.0–4.5   LEFT (Without) panel reveals: dim, 0/5 closed, sad stats
 *  4.5–7.5   RIGHT (With) panel slides in: bright, 5/5 closed, $74,200
 *  7.5–10.5  delta callout: same day, same patients
 * 10.5–13.0  "Different financing layer." big text
 * 13.0–15.0  CTA + compliance
 */
import { VideoStage, TEAL_2 } from '../_stage';
import { Mark, Tag, Cta, SHARED_CHROME_CSS } from '../_chrome';

export default function MedPayVideoV6(): JSX.Element {
  return (
    <VideoStage
      css={`
        ${SHARED_CHROME_CSS}

        .v6-timestamp {
          position: absolute;
          top: 240px;
          left: 0;
          right: 0;
          text-align: center;
          opacity: 0;
          animation: vs-in-up 0.6s 0.8s forwards;
        }
        .v6-ts-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 22px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: ${TEAL_2};
          text-transform: uppercase;
        }
        .v6-ts-h {
          margin-top: 10px;
          font-size: 80px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #fff;
        }

        /* split panels */
        .v6-panels {
          position: absolute;
          top: 460px;
          left: 64px;
          right: 64px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .v6-panel {
          padding: 32px 36px;
          border-radius: 28px;
          opacity: 0;
        }
        .v6-panel-without {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: rgba(255, 255, 255, 0.62);
          animation: vs-in-up 0.6s 2s forwards;
        }
        .v6-panel-with {
          background:
            radial-gradient(ellipse 80% 100% at 0% 0%, rgba(34, 184, 160, 0.28), transparent 65%),
            rgba(34, 184, 160, 0.1);
          border: 1px solid rgba(34, 184, 160, 0.55);
          color: #fff;
          box-shadow: 0 40px 80px -20px rgba(34, 184, 160, 0.45);
          animation: vs-in-up 0.6s 4.5s forwards;
        }
        .v6-panel-tag {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 15px;
          letter-spacing: 0.2em;
          font-weight: 700;
          text-transform: uppercase;
        }
        .v6-panel-without .v6-panel-tag {
          color: rgba(255, 255, 255, 0.5);
        }
        .v6-panel-with .v6-panel-tag {
          color: ${TEAL_2};
        }
        .v6-panel-h {
          margin-top: 10px;
          font-size: 56px;
          font-weight: 800;
          letter-spacing: -0.024em;
          line-height: 1;
        }
        .v6-panel-h em {
          font-style: normal;
          color: ${TEAL_2};
        }
        .v6-stat-row {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .v6-stat {
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .v6-panel-with .v6-stat {
          background: rgba(255, 255, 255, 0.08);
        }
        .v6-stat-k {
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.16em;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
        }
        .v6-panel-with .v6-stat-k {
          color: rgba(255, 255, 255, 0.7);
        }
        .v6-stat-v {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.022em;
          font-variant-numeric: tabular-nums;
        }
        .v6-panel-without .v6-stat-v {
          color: rgba(255, 255, 255, 0.8);
        }
        .v6-panel-with .v6-stat-v {
          color: #fff;
        }

        /* big closing headline */
        .v6-close {
          position: absolute;
          top: 1500px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.028em;
          line-height: 1.18;
          color: #fff;
          opacity: 0;
          animation: vs-num-in 0.7s 10.5s forwards;
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
        .v6-close em {
          font-style: normal;
          color: ${TEAL_2};
        }
      `}
    >
      <Mark />
      <Tag>Before / After · daily</Tag>

      <div className="v6-timestamp">
        <div className="v6-ts-tag">Tuesday · 5 PM · same practice</div>
        <div className="v6-ts-h">One day. Two endings.</div>
      </div>

      <div className="v6-panels">
        <article className="v6-panel v6-panel-without">
          <div className="v6-panel-tag">Without MedPay</div>
          <h3 className="v6-panel-h">0 of 5 closed today</h3>
          <div className="v6-stat-row">
            <div className="v6-stat">
              <span className="v6-stat-k">Consults</span>
              <span className="v6-stat-v">5</span>
            </div>
            <div className="v6-stat">
              <span className="v6-stat-k">Funded</span>
              <span className="v6-stat-v">$0</span>
            </div>
            <div className="v6-stat">
              <span className="v6-stat-k">Follow-ups owed</span>
              <span className="v6-stat-v">5</span>
            </div>
          </div>
        </article>

        <article className="v6-panel v6-panel-with">
          <div className="v6-panel-tag">With MedPay</div>
          <h3 className="v6-panel-h">
            5 of 5 closed · <em>same day</em>
          </h3>
          <div className="v6-stat-row">
            <div className="v6-stat">
              <span className="v6-stat-k">Consults</span>
              <span className="v6-stat-v">5</span>
            </div>
            <div className="v6-stat">
              <span className="v6-stat-k">Funded</span>
              <span className="v6-stat-v">$74,200</span>
            </div>
            <div className="v6-stat">
              <span className="v6-stat-k">Follow-ups owed</span>
              <span className="v6-stat-v">0</span>
            </div>
          </div>
        </article>
      </div>

      <div className="v6-close">
        Same hours. Same patients.
        <br />
        Different <em>financing layer.</em>
      </div>

      <Cta label="Run your day on MedPay" ctaDelay={13.2} disclDelay={13.6} />
    </VideoStage>
  );
}
