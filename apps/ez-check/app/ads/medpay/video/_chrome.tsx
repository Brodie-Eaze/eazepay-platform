/**
 * Shared video chrome — brand mark (top-left), audience tag (top-right),
 * CTA pill (bottom), compliance disclosure (very bottom).
 *
 * Every variant uses these in identical positions so the deck reads as
 * a unified campaign. CSS for these classes lives in _stage.tsx via
 * the SHARED_CHROME_CSS export below — drop it into each variant's
 * own `css` template literal.
 */
import { TEAL_2 } from './_stage';

export const SHARED_CHROME_CSS = `
  .mp-mark {
    position: absolute; top: 56px; left: 56px;
    display: inline-flex; align-items: center; gap: 16px;
    font-size: 36px; font-weight: 800; color: #fff;
    letter-spacing: -0.02em;
    opacity: 0;
    animation: vs-in-down 0.6s 0.2s forwards;
  }
  .mp-mark-sq {
    width: 48px; height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
    box-shadow: 0 12px 28px -8px rgba(34, 184, 160, 0.55);
  }
  .mp-mark-slash { color: rgba(255,255,255,0.4); margin: 0 2px; font-weight: 300; }
  .mp-mark-l { color: ${TEAL_2}; }

  .mp-tag {
    position: absolute; top: 56px; right: 56px;
    padding: 10px 16px;
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 13px; letter-spacing: 0.22em; font-weight: 700;
    color: ${TEAL_2}; text-transform: uppercase;
    background: rgba(34, 184, 160, 0.14);
    border: 1px solid rgba(34, 184, 160, 0.34);
    border-radius: 999px;
    opacity: 0;
    animation: vs-in-down 0.6s 0.4s forwards;
  }

  .mp-cta {
    position: absolute;
    bottom: 200px; left: 0; right: 0;
    text-align: center;
    opacity: 0;
  }
  .mp-cta-btn {
    display: inline-flex; align-items: center; gap: 14px;
    padding: 28px 50px;
    background: linear-gradient(135deg, #0e7c66, ${TEAL_2});
    color: #fff;
    border-radius: 999px;
    font-size: 34px; font-weight: 800;
    letter-spacing: -0.01em;
    box-shadow: 0 28px 60px -16px rgba(34, 184, 160, 0.60);
    animation: vs-pulse 1.8s 14.2s infinite;
  }
  @keyframes vs-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }

  .mp-discl {
    position: absolute;
    bottom: 56px; left: 56px; right: 56px;
    font-size: 15px; line-height: 1.5;
    color: rgba(255, 255, 255, 0.50);
    text-align: center;
    opacity: 0;
  }
`;

export function Mark(): JSX.Element {
  return (
    <div className="mp-mark">
      <span className="mp-mark-sq" />
      <span>
        <span className="mp-mark-l">Med</span>
        <span className="mp-mark-slash">/</span>
        <span>Pay</span>
      </span>
    </div>
  );
}

export function Tag({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="mp-tag">{children}</div>;
}

/**
 * CTA + disclosure footer combo. ctaDelay + disclDelay let each variant
 * time the close to its specific beat (default tuned to 13.6s / 14.0s).
 */
export function Cta({
  label,
  ctaDelay = 13.6,
  disclDelay = 14.0,
}: {
  label: string;
  ctaDelay?: number;
  disclDelay?: number;
}): JSX.Element {
  return (
    <>
      <div className="mp-cta" style={{ animation: `vs-in-up 0.55s ${ctaDelay}s forwards` }}>
        <div className="mp-cta-btn">{label} →</div>
      </div>
      <div className="mp-discl" style={{ animation: `vs-in-up 0.55s ${disclDelay}s forwards` }}>
        EazePay, LLC · NMLS #2456701 · Loans subject to lender approval. Soft-pull pre-qualification
        has zero impact on credit score. Not a guarantee of approval.
      </div>
    </>
  );
}
