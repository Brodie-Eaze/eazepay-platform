/**
 * MedPay ad variant 1 — "CFO Math"
 *
 * The $1.4M-lost-per-year hook against a mocked offer card showing
 * what a recovered case looks like. Aimed at practice owners /
 * multi-location operators.
 */
import { AdCanvas, MEDPAY_TEAL_2 } from '../_canvas';

export default function MedPayAdV1(): JSX.Element {
  return (
    <AdCanvas variant="V1 · CFO MATH" hookTag="Practice owners · ROI" cta="See the math">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .v1-wrap { display: grid; grid-template-columns: 1.2fr 1fr; gap: 56px; align-items: center; }
            .v1-num {
              font-size: 168px; font-weight: 800;
              letter-spacing: -0.04em; line-height: 0.95;
              background: linear-gradient(135deg, #fff 0%, ${MEDPAY_TEAL_2} 100%);
              -webkit-background-clip: text; background-clip: text; color: transparent;
            }
            .v1-num-sub {
              margin-top: 12px;
              font-size: 22px; font-weight: 600;
              color: rgba(255, 255, 255, 0.78);
              letter-spacing: 0.02em;
            }
            .v1-bar { height: 3px; width: 96px; background: ${MEDPAY_TEAL_2}; margin: 28px 0; border-radius: 999px; }
            .v1-copy {
              font-size: 36px; font-weight: 600; line-height: 1.22;
              letter-spacing: -0.022em;
              color: #fff;
              max-width: 520px;
            }
            .v1-copy em { font-style: normal; color: ${MEDPAY_TEAL_2}; }
            .v1-card {
              position: relative;
              padding: 32px;
              border-radius: 28px;
              background:
                radial-gradient(ellipse 70% 60% at 0% 0%, rgba(34, 184, 160, 0.22), transparent 65%),
                rgba(255, 255, 255, 0.06);
              border: 1px solid rgba(34, 184, 160, 0.34);
              backdrop-filter: blur(16px);
              box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.55);
            }
            .v1-card-tag {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 11px; letter-spacing: 0.22em; font-weight: 700;
              color: ${MEDPAY_TEAL_2};
              text-transform: uppercase;
            }
            .v1-card-name { margin-top: 8px; font-size: 36px; font-weight: 800; letter-spacing: -0.024em; color: #fff; }
            .v1-card-tier-row { margin-top: 6px; display: inline-flex; align-items: center; gap: 10px; }
            .v1-card-tier-pill {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 10px; letter-spacing: 0.18em; font-weight: 700;
              color: ${MEDPAY_TEAL_2};
              padding: 4px 9px;
              background: rgba(34, 184, 160, 0.16);
              border-radius: 6px;
            }
            .v1-card-signals {
              margin-top: 24px;
              display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 2px;
              background: rgba(255, 255, 255, 0.08);
              border-radius: 14px;
              overflow: hidden;
            }
            .v1-card-sig {
              padding: 14px 8px;
              background: rgba(10, 20, 18, 0.92);
              display: flex; flex-direction: column; gap: 4px;
              align-items: center;
            }
            .v1-card-sig-k {
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 9px; letter-spacing: 0.14em; font-weight: 700;
              color: rgba(255, 255, 255, 0.55);
              text-transform: uppercase;
            }
            .v1-card-sig-v {
              font-size: 20px; font-weight: 800;
              letter-spacing: -0.02em;
              color: #fff;
            }
            .v1-card-rails {
              margin-top: 18px;
              display: flex; flex-direction: column; gap: 10px;
            }
            .v1-card-rail {
              display: flex; justify-content: space-between; align-items: center;
              font-size: 16px;
            }
            .v1-card-rail-l { color: #fff; font-weight: 600; }
            .v1-card-rail-amt {
              color: ${MEDPAY_TEAL_2};
              font-weight: 700;
              font-variant-numeric: tabular-nums;
            }
          `,
        }}
      />
      <div className="v1-wrap">
        <div>
          <div className="v1-num">$1.4M</div>
          <div className="v1-num-sub">per year, walks out of your practice unfunded</div>
          <div className="v1-bar" />
          <p className="v1-copy">
            MedPay turns "I'll <em>think about it</em>" into <em>signed and funded</em> in the same
            visit.
          </p>
        </div>
        <div className="v1-card">
          <div className="v1-card-tag">RECOVERED CASE · TIER A</div>
          <div className="v1-card-name">Jordan M.</div>
          <div className="v1-card-tier-row">
            <span className="v1-card-tier-pill">Tier · verified</span>
          </div>
          <div className="v1-card-signals">
            <div className="v1-card-sig">
              <span className="v1-card-sig-k">Credit</span>
              <span className="v1-card-sig-v">724</span>
            </div>
            <div className="v1-card-sig">
              <span className="v1-card-sig-k">Available</span>
              <span className="v1-card-sig-v">$12.4k</span>
            </div>
            <div className="v1-card-sig">
              <span className="v1-card-sig-k">Income</span>
              <span className="v1-card-sig-v">$98k</span>
            </div>
            <div className="v1-card-sig">
              <span className="v1-card-sig-k">DTI</span>
              <span className="v1-card-sig-v">22%</span>
            </div>
          </div>
          <div className="v1-card-rails">
            <div className="v1-card-rail">
              <span className="v1-card-rail-l">✓ Consumer-direct</span>
              <span className="v1-card-rail-amt">$14,200</span>
            </div>
            <div className="v1-card-rail">
              <span className="v1-card-rail-l">✓ Merchant-direct</span>
              <span className="v1-card-rail-amt">$18,500</span>
            </div>
            <div className="v1-card-rail">
              <span className="v1-card-rail-l">✓ BNPL</span>
              <span className="v1-card-rail-amt">$5,000</span>
            </div>
          </div>
        </div>
      </div>
    </AdCanvas>
  );
}
