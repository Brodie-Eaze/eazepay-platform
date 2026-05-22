/**
 * MedPay ad variant 4 — "10 Seconds at the Chair"
 *
 * Operational speed hook. Stylized tablet showing the 4-field
 * soft-pull form auto-populating with a timer counter.
 */
import { AdCanvas, MEDPAY_TEAL_2 } from '../_canvas';

export default function MedPayAdV4(): JSX.Element {
  return (
    <AdCanvas
      variant="V4 · 10 SECONDS"
      hookTag="Operational speed · soft pull"
      cta="See it in action"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .v4-wrap { display: grid; grid-template-columns: 1.05fr 1fr; gap: 56px; align-items: center; }
            .v4-h {
              font-size: 92px; font-weight: 800;
              letter-spacing: -0.04em; line-height: 0.98;
              margin: 0 0 24px;
            }
            .v4-h em { font-style: normal;
              background: linear-gradient(135deg, ${MEDPAY_TEAL_2} 0%, #fff 100%);
              -webkit-background-clip: text; background-clip: text; color: transparent;
            }
            .v4-sub {
              font-size: 26px; line-height: 1.4; font-weight: 600;
              color: rgba(255, 255, 255, 0.78);
              max-width: 460px;
              margin: 0 0 28px;
            }
            .v4-chips {
              display: flex; flex-wrap: wrap; gap: 10px;
            }
            .v4-chip {
              padding: 10px 16px;
              background: rgba(34, 184, 160, 0.14);
              border: 1px solid rgba(34, 184, 160, 0.34);
              color: ${MEDPAY_TEAL_2};
              border-radius: 999px;
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 13px; font-weight: 700;
              letter-spacing: 0.06em;
              text-transform: uppercase;
            }
            .v4-tablet {
              position: relative;
              background: linear-gradient(135deg, #0F2724 0%, #062120 100%);
              padding: 22px;
              border-radius: 36px;
              box-shadow:
                0 60px 110px -40px rgba(0, 0, 0, 0.6),
                0 0 0 1px rgba(34, 184, 160, 0.20),
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
              transform: rotate(-2deg);
            }
            .v4-tablet-screen {
              background: #fff;
              border-radius: 22px;
              padding: 28px;
              color: #0A1F1D;
            }
            .v4-tablet-h {
              display: flex; justify-content: space-between; align-items: center;
              padding-bottom: 14px;
              border-bottom: 1px solid rgba(14, 124, 102, 0.14);
            }
            .v4-tablet-brand {
              font-size: 13px; letter-spacing: 0.18em; font-weight: 700;
              color: #0E7C66;
              text-transform: uppercase;
            }
            .v4-tablet-timer {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 13px; font-weight: 700;
              color: #fff;
              background: linear-gradient(135deg, #0E7C66 0%, ${MEDPAY_TEAL_2} 100%);
              padding: 5px 11px;
              border-radius: 6px;
              letter-spacing: 0.04em;
            }
            .v4-tablet-title {
              margin-top: 16px;
              font-size: 24px; font-weight: 800;
              letter-spacing: -0.02em;
              color: #0A1F1D;
            }
            .v4-tablet-sub {
              margin-top: 4px;
              font-size: 14px;
              color: #4B6864;
            }
            .v4-tablet-fields {
              margin-top: 18px;
              display: flex; flex-direction: column;
              gap: 8px;
            }
            .v4-tablet-field {
              display: flex; flex-direction: column;
              gap: 4px;
              padding: 12px 14px;
              background: rgba(14, 124, 102, 0.06);
              border: 1px solid rgba(14, 124, 102, 0.18);
              border-radius: 10px;
            }
            .v4-tablet-field-k {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
              color: #4B6864;
              text-transform: uppercase;
            }
            .v4-tablet-field-v {
              font-size: 16px; font-weight: 700;
              color: #0A1F1D;
              font-variant-numeric: tabular-nums;
            }
            .v4-tablet-btn {
              margin-top: 16px;
              padding: 14px;
              text-align: center;
              background: linear-gradient(135deg, #062C29 0%, #0E7C66 100%);
              color: #fff;
              border-radius: 12px;
              font-size: 15px; font-weight: 700;
              letter-spacing: 0.02em;
            }
          `,
        }}
      />
      <div className="v4-wrap">
        <div>
          <h1 className="v4-h">
            10 seconds.
            <br />
            <em>4 fields.</em>
            <br />
            Zero credit impact.
          </h1>
          <p className="v4-sub">
            Patient walks back to the chair already knowing what they qualify for. Hand them the
            tablet between the consult and the close.
          </p>
          <div className="v4-chips">
            <span className="v4-chip">FCRA · Soft pull</span>
            <span className="v4-chip">Any device</span>
            <span className="v4-chip">Multi-lender</span>
          </div>
        </div>
        <div className="v4-tablet">
          <div className="v4-tablet-screen">
            <div className="v4-tablet-h">
              <span className="v4-tablet-brand">MedPay · pre-qual</span>
              <span className="v4-tablet-timer">0:08</span>
            </div>
            <div className="v4-tablet-title">Quick pre-qual</div>
            <div className="v4-tablet-sub">Soft pull · zero impact on credit</div>
            <div className="v4-tablet-fields">
              <div className="v4-tablet-field">
                <div className="v4-tablet-field-k">Email</div>
                <div className="v4-tablet-field-v">jordan@example.com</div>
              </div>
              <div className="v4-tablet-field">
                <div className="v4-tablet-field-k">Date of birth</div>
                <div className="v4-tablet-field-v">04 / 12 / 1985</div>
              </div>
              <div className="v4-tablet-field">
                <div className="v4-tablet-field-k">Last 4 SSN</div>
                <div className="v4-tablet-field-v">••••</div>
              </div>
              <div className="v4-tablet-field">
                <div className="v4-tablet-field-k">Treatment budget</div>
                <div className="v4-tablet-field-v">$10k – $25k</div>
              </div>
            </div>
            <div className="v4-tablet-btn">Submit · run pre-qualification</div>
          </div>
        </div>
      </div>
    </AdCanvas>
  );
}
