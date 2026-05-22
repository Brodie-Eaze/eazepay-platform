/**
 * MedPay ad variant 3 — "Cherry vs MedPay"
 *
 * Competitive switch ad. Side-by-side panel showing a single-lender
 * decline next to a 3-rail marketplace approval on the same buyer.
 */
import { AdCanvas, MEDPAY_TEAL_2 } from '../_canvas';

export default function MedPayAdV3(): JSX.Element {
  return (
    <AdCanvas
      variant="V3 · CHERRY vs MEDPAY"
      hookTag="Switch · marketplace"
      cta="Compare approval rates"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .v3-h {
              font-size: 76px; font-weight: 800;
              letter-spacing: -0.04em; line-height: 1.04;
              margin: 0 0 36px; max-width: 920px;
            }
            .v3-h em { font-style: normal;
              background: linear-gradient(135deg, ${MEDPAY_TEAL_2} 0%, #fff 100%);
              -webkit-background-clip: text; background-clip: text; color: transparent;
            }
            .v3-grid {
              display: grid; grid-template-columns: 1fr 1fr;
              gap: 24px;
            }
            .v3-panel {
              padding: 28px;
              border-radius: 24px;
              border: 1px solid rgba(255, 255, 255, 0.14);
              background: rgba(255, 255, 255, 0.04);
              backdrop-filter: blur(14px);
              min-height: 320px;
              display: flex; flex-direction: column;
            }
            .v3-panel-med {
              background:
                radial-gradient(ellipse 80% 100% at 0% 0%, rgba(34, 184, 160, 0.30), transparent 65%),
                rgba(34, 184, 160, 0.10);
              border-color: rgba(34, 184, 160, 0.55);
              box-shadow: 0 30px 60px -20px rgba(34, 184, 160, 0.45);
            }
            .v3-panel-tag {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 12px; letter-spacing: 0.22em; font-weight: 700;
              color: rgba(255, 255, 255, 0.55);
              text-transform: uppercase;
              margin-bottom: 14px;
            }
            .v3-panel-med .v3-panel-tag { color: ${MEDPAY_TEAL_2}; }
            .v3-panel-h {
              font-size: 32px; font-weight: 700;
              letter-spacing: -0.02em; line-height: 1.15;
              color: #fff;
              margin-bottom: 22px;
            }
            .v3-row {
              display: flex; justify-content: space-between; align-items: center;
              padding: 14px 16px;
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(255, 255, 255, 0.10);
              border-radius: 12px;
              margin-bottom: 10px;
            }
            .v3-panel-med .v3-row {
              background: rgba(34, 184, 160, 0.10);
              border-color: rgba(34, 184, 160, 0.30);
            }
            .v3-row-l { display: inline-flex; align-items: center; gap: 12px; font-size: 18px; font-weight: 600; color: #fff; }
            .v3-row-r { display: inline-flex; align-items: center; gap: 10px; }
            .v3-mark {
              width: 24px; height: 24px;
              border-radius: 999px;
              display: inline-flex; align-items: center; justify-content: center;
              font-size: 14px; font-weight: 700;
            }
            .v3-mark-x { background: rgba(239, 68, 68, 0.18); color: #FCA5A5; }
            .v3-mark-check { background: rgba(34, 184, 160, 0.28); color: ${MEDPAY_TEAL_2}; }
            .v3-amt { font-size: 17px; font-weight: 700; color: rgba(255, 255, 255, 0.55); font-variant-numeric: tabular-nums; }
            .v3-panel-med .v3-amt { color: #fff; }
            .v3-flag {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 9.5px; letter-spacing: 0.16em; font-weight: 700;
              padding: 3px 8px;
              border-radius: 5px;
              text-transform: uppercase;
            }
            .v3-flag-declined { background: rgba(239, 68, 68, 0.16); color: #FCA5A5; border: 1px solid rgba(239, 68, 68, 0.34); }
            .v3-flag-approved { background: rgba(34, 184, 160, 0.20); color: ${MEDPAY_TEAL_2}; border: 1px solid rgba(34, 184, 160, 0.40); }
            .v3-panel-outcome {
              margin-top: auto;
              padding: 14px 16px;
              border-radius: 12px;
              font-size: 16px; font-weight: 700;
              letter-spacing: -0.01em;
              text-align: center;
            }
            .v3-panel-outcome-bad {
              background: rgba(239, 68, 68, 0.12);
              color: #FCA5A5;
              border: 1px solid rgba(239, 68, 68, 0.28);
            }
            .v3-panel-outcome-good {
              background: linear-gradient(135deg, rgba(34, 184, 160, 0.40), rgba(14, 124, 102, 0.55));
              color: #fff;
            }
          `,
        }}
      />
      <h1 className="v3-h">
        Same patient. <em>Three more lenders just said yes.</em>
      </h1>
      <div className="v3-grid">
        <article className="v3-panel">
          <div className="v3-panel-tag">Single-lender · Cherry / Sunbit</div>
          <div className="v3-panel-h">Decline. Patient walks.</div>
          <div className="v3-row">
            <span className="v3-row-l">
              <span className="v3-mark v3-mark-x">×</span> Lender A
            </span>
            <span className="v3-row-r">
              <span className="v3-amt">—</span>
              <span className="v3-flag v3-flag-declined">Declined</span>
            </span>
          </div>
          <div className="v3-panel-outcome v3-panel-outcome-bad">
            Patient walks. Treatment plan lost.
          </div>
        </article>
        <article className="v3-panel v3-panel-med">
          <div className="v3-panel-tag">MedPay · multi-lender marketplace</div>
          <div className="v3-panel-h">3 rails. One soft pull.</div>
          <div className="v3-row">
            <span className="v3-row-l">
              <span className="v3-mark v3-mark-check">✓</span> Consumer-direct
            </span>
            <span className="v3-row-r">
              <span className="v3-amt">$14,200</span>
              <span className="v3-flag v3-flag-approved">Pre-app</span>
            </span>
          </div>
          <div className="v3-row">
            <span className="v3-row-l">
              <span className="v3-mark v3-mark-check">✓</span> Merchant-direct
            </span>
            <span className="v3-row-r">
              <span className="v3-amt">$18,500</span>
              <span className="v3-flag v3-flag-approved">Pre-app</span>
            </span>
          </div>
          <div className="v3-row">
            <span className="v3-row-l">
              <span className="v3-mark v3-mark-check">✓</span> BNPL
            </span>
            <span className="v3-row-r">
              <span className="v3-amt">$5,000</span>
              <span className="v3-flag v3-flag-approved">Pre-app</span>
            </span>
          </div>
          <div className="v3-panel-outcome v3-panel-outcome-good">Funded. Booked. Same day.</div>
        </article>
      </div>
    </AdCanvas>
  );
}
