/**
 * MedPay ad variant 2 — "Walked Out"
 *
 * Emotional, scenario-driven. Two speech bubbles framing the patient
 * conversation before and after MedPay enters the picture.
 */
import { AdCanvas, MEDPAY_TEAL_2 } from '../_canvas';

export default function MedPayAdV2(): JSX.Element {
  return (
    <AdCanvas
      variant="V2 · WALKED OUT"
      hookTag="Treatment coordinators · scenario"
      cta="Book a 15-min demo"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .v2-h {
              font-size: 80px; font-weight: 800;
              letter-spacing: -0.04em; line-height: 1.02;
              margin: 0 0 32px;
            }
            .v2-h em { font-style: normal;
              background: linear-gradient(135deg, ${MEDPAY_TEAL_2} 0%, #fff 100%);
              -webkit-background-clip: text; background-clip: text; color: transparent;
            }
            .v2-bubbles {
              display: flex; flex-direction: column; gap: 22px;
              max-width: 880px;
            }
            .v2-bubble {
              padding: 26px 32px;
              border-radius: 26px 26px 26px 6px;
              font-size: 32px; font-weight: 600;
              letter-spacing: -0.02em; line-height: 1.3;
              max-width: 720px;
            }
            .v2-bubble-before {
              background: rgba(255, 255, 255, 0.06);
              border: 1px solid rgba(255, 255, 255, 0.14);
              color: rgba(255, 255, 255, 0.62);
              align-self: flex-start;
            }
            .v2-bubble-after {
              background: linear-gradient(135deg, rgba(34, 184, 160, 0.32), rgba(14, 124, 102, 0.42));
              border: 1px solid rgba(34, 184, 160, 0.55);
              color: #fff;
              border-radius: 26px 26px 6px 26px;
              align-self: flex-end;
              box-shadow: 0 24px 50px -16px rgba(34, 184, 160, 0.45);
            }
            .v2-tag {
              display: inline-block;
              padding: 6px 12px;
              border-radius: 999px;
              font-family: 'SF Mono', Menlo, monospace;
              font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
              text-transform: uppercase;
              margin-bottom: 12px;
            }
            .v2-tag-before { background: rgba(255, 255, 255, 0.10); color: rgba(255, 255, 255, 0.62); }
            .v2-tag-after { background: rgba(34, 184, 160, 0.20); color: ${MEDPAY_TEAL_2}; }
            .v2-arrow {
              align-self: center;
              font-size: 28px; color: ${MEDPAY_TEAL_2};
              padding: 4px 0;
              opacity: 0.85;
            }
            .v2-attrib {
              margin-top: 28px;
              font-size: 18px; color: rgba(255, 255, 255, 0.55);
              letter-spacing: 0.02em;
            }
            .v2-attrib strong { color: ${MEDPAY_TEAL_2}; font-weight: 700; }
          `,
        }}
      />
      <h1 className="v2-h">
        She walked out to <em>"think about it."</em>
        <br />
        She never came back.
      </h1>
      <div className="v2-bubbles">
        <div className="v2-bubble v2-bubble-before">
          <div className="v2-tag v2-tag-before">Before MedPay</div>
          "It's $12,000 for the implants. Let me think about it."
        </div>
        <div className="v2-arrow">↓</div>
        <div className="v2-bubble v2-bubble-after">
          <div className="v2-tag v2-tag-after">With MedPay · 10s pre-qual</div>
          "$295 a month? Let's book the first appointment today."
        </div>
      </div>
      <p className="v2-attrib">
        <strong>73%</strong> of "I'll think about it" patients never come back. MedPay closes them
        before they leave the chair.
      </p>
    </AdCanvas>
  );
}
