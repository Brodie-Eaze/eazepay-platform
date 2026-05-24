/**
 * MedPay ad variant 5 — "38% → 70%"
 *
 * Outcome / results hook. Bar chart with the same-day close-rate
 * delta visualized; aimed at multi-location operators + DSOs.
 */
import { AdCanvas, MEDPAY_TEAL_2 } from '../_canvas';

export default function MedPayAdV5(): JSX.Element {
  return (
    <AdCanvas variant="V5 · 38 → 70" hookTag="Outcome · same-day close" cta="Run your numbers">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .v5-h {
              font-size: 80px; font-weight: 800;
              letter-spacing: -0.04em; line-height: 1.02;
              margin: 0 0 24px;
            }
            .v5-h em { font-style: normal;
              background: linear-gradient(135deg, ${MEDPAY_TEAL_2} 0%, #fff 100%);
              -webkit-background-clip: text; background-clip: text; color: transparent;
            }
            .v5-sub {
              font-size: 22px; line-height: 1.4; font-weight: 500;
              color: rgba(255, 255, 255, 0.78);
              max-width: 720px;
              margin: 0 0 44px;
            }
            .v5-chart {
              padding: 36px 40px;
              border-radius: 28px;
              background:
                radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.18), transparent 65%),
                rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(34, 184, 160, 0.28);
              backdrop-filter: blur(14px);
              box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.45);
            }
            .v5-bar-row {
              display: grid; grid-template-columns: 240px 1fr 80px;
              gap: 20px; align-items: center;
              margin-bottom: 18px;
            }
            .v5-bar-row:last-of-type { margin-bottom: 0; }
            .v5-bar-label {
              font-size: 16px; font-weight: 600;
              color: rgba(255, 255, 255, 0.74);
              letter-spacing: -0.01em;
            }
            .v5-bar-track {
              height: 56px;
              background: rgba(255, 255, 255, 0.06);
              border-radius: 14px;
              overflow: hidden;
              position: relative;
            }
            .v5-bar-fill {
              height: 100%;
              border-radius: 14px;
              display: flex; align-items: center; justify-content: flex-end;
              padding-right: 18px;
              font-size: 22px; font-weight: 800;
              color: #fff;
              letter-spacing: -0.012em;
              font-variant-numeric: tabular-nums;
            }
            .v5-bar-fill.before {
              width: 38%;
              background: linear-gradient(90deg, rgba(148, 163, 184, 0.55) 0%, rgba(100, 116, 139, 0.85) 100%);
            }
            .v5-bar-fill.after {
              width: 72%;
              background: linear-gradient(90deg, #0E7C66 0%, ${MEDPAY_TEAL_2} 100%);
              box-shadow: 0 0 30px rgba(34, 184, 160, 0.45);
            }
            .v5-bar-pct {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 14px; font-weight: 700;
              color: rgba(255, 255, 255, 0.55);
              letter-spacing: 0.04em;
              text-align: right;
            }
            .v5-delta {
              margin-top: 30px;
              padding: 20px 28px;
              background: linear-gradient(135deg, rgba(34, 184, 160, 0.30), rgba(14, 124, 102, 0.42));
              border: 1px solid rgba(34, 184, 160, 0.55);
              border-radius: 18px;
              display: flex; justify-content: space-between; align-items: center;
              gap: 24px;
            }
            .v5-delta-l {
              display: flex; flex-direction: column; gap: 4px;
            }
            .v5-delta-tag {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 11px; letter-spacing: 0.22em; font-weight: 700;
              color: ${MEDPAY_TEAL_2};
              text-transform: uppercase;
            }
            .v5-delta-h {
              font-size: 26px; font-weight: 800;
              letter-spacing: -0.02em;
              color: #fff;
            }
            .v5-delta-num {
              font-size: 56px; font-weight: 800;
              letter-spacing: -0.04em;
              background: linear-gradient(135deg, #fff 0%, ${MEDPAY_TEAL_2} 100%);
              -webkit-background-clip: text; background-clip: text; color: transparent;
              line-height: 1;
              font-variant-numeric: tabular-nums;
            }
          `,
        }}
      />
      <h1 className="v5-h">
        38% → <em>70%</em> same-day close.
      </h1>
      <p className="v5-sub">
        Industry baseline: 38%. Practices on MedPay: 70%+. Same patients, same procedures —
        different financing layer at the chair.
      </p>
      <div className="v5-chart">
        <div className="v5-bar-row">
          <div className="v5-bar-label">Industry baseline</div>
          <div className="v5-bar-track">
            <div className="v5-bar-fill before">38%</div>
          </div>
          <div className="v5-bar-pct">38%</div>
        </div>
        <div className="v5-bar-row">
          <div className="v5-bar-label">Practices on MedPay</div>
          <div className="v5-bar-track">
            <div className="v5-bar-fill after">70%+</div>
          </div>
          <div className="v5-bar-pct">+70%</div>
        </div>
        <div className="v5-delta">
          <div className="v5-delta-l">
            <span className="v5-delta-tag">Delta · same-day close</span>
            <span className="v5-delta-h">Move the needle on case acceptance</span>
          </div>
          <span className="v5-delta-num">+32 pts</span>
        </div>
      </div>
    </AdCanvas>
  );
}
