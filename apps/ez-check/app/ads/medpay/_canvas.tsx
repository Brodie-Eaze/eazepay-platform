/**
 * Shared 1080×1080 canvas + MedPay teal chrome for the ad mockups.
 *
 * Each variant page renders <AdCanvas headline body cta>{visual}</AdCanvas>.
 * The page-level body is sized to the canvas so the preview-server
 * screenshot at 1080×1080 gives a clean export-ready PNG.
 */
import type { ReactNode } from 'react';

export const MEDPAY_TEAL = '#0E7C66';
export const MEDPAY_TEAL_2 = '#22B8A0';
export const MEDPAY_DEEP = '#062C29';
export const MEDPAY_INK = '#0A1F1D';
export const MEDPAY_MUTE = '#4B6864';

export function AdCanvas({
  variant,
  hookTag,
  children,
  cta,
}: {
  variant: string;
  hookTag: string;
  children: ReactNode;
  cta: string;
}): JSX.Element {
  return (
    <div className="ad-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ad-canvas">
        <div className="ad-glow" aria-hidden />
        <header className="ad-head">
          <div className="ad-brand">
            <span className="ad-brand-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect
                  x="2"
                  y="3"
                  width="20"
                  height="18"
                  rx="4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M7 12h10M12 7v10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="ad-brand-word">
              <span className="ad-brand-l">Med</span>
              <span className="ad-brand-slash">/</span>
              <span className="ad-brand-r">Pay</span>
            </span>
          </div>
          <div className="ad-hook-tag">{hookTag}</div>
        </header>

        <main className="ad-body">{children}</main>

        <footer className="ad-foot">
          <div className="ad-cta">
            {cta}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="ad-discl">
            EazePay, LLC · NMLS #2456701 · Loans subject to lender approval. APR, term, and payment
            vary by lender and applicant profile. Soft-pull pre-qualification has zero impact on
            credit score. Not a guarantee of approval.
          </div>
        </footer>

        <div className="ad-variant-stamp" aria-hidden>
          {variant}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  html, body, #__next, main { margin: 0; padding: 0; background: #050a14; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }

  .ad-root {
    width: 1080px; height: 1080px;
    display: flex; align-items: center; justify-content: center;
    background: #050a14;
    -webkit-font-smoothing: antialiased;
  }

  .ad-canvas {
    position: relative;
    width: 1080px; height: 1080px;
    color: #fff;
    overflow: hidden;
    background:
      radial-gradient(ellipse 60% 50% at 15% 10%, rgba(34, 184, 160, 0.32) 0%, transparent 60%),
      radial-gradient(ellipse 50% 60% at 85% 90%, rgba(14, 124, 102, 0.36) 0%, transparent 55%),
      linear-gradient(180deg, ${MEDPAY_DEEP} 0%, #051A18 100%);
    padding: 56px 64px;
    display: flex; flex-direction: column;
    box-sizing: border-box;
  }
  .ad-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(circle at 50% 0%, rgba(34, 184, 160, 0.20), transparent 50%);
    pointer-events: none;
  }
  .ad-head {
    position: relative; z-index: 2;
    display: flex; justify-content: space-between; align-items: center;
  }
  .ad-brand { display: inline-flex; align-items: center; gap: 14px; }
  .ad-brand-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 44px; height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, ${MEDPAY_TEAL} 0%, ${MEDPAY_TEAL_2} 100%);
    color: #fff;
    box-shadow: 0 10px 24px -8px rgba(34, 184, 160, 0.55);
  }
  .ad-brand-word {
    font-size: 32px; font-weight: 800;
    letter-spacing: -0.02em; color: #fff;
  }
  .ad-brand-l { color: ${MEDPAY_TEAL_2}; }
  .ad-brand-slash { color: rgba(255, 255, 255, 0.40); margin: 0 2px; font-weight: 300; }
  .ad-brand-r { color: #fff; }
  .ad-hook-tag {
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 12px; letter-spacing: 0.22em; font-weight: 700;
    color: ${MEDPAY_TEAL_2};
    text-transform: uppercase;
    padding: 8px 14px;
    background: rgba(34, 184, 160, 0.12);
    border: 1px solid rgba(34, 184, 160, 0.34);
    border-radius: 999px;
  }

  .ad-body {
    position: relative; z-index: 2;
    flex: 1;
    display: flex; flex-direction: column;
    justify-content: center;
    margin: 48px 0;
  }

  .ad-foot {
    position: relative; z-index: 2;
    display: flex; flex-direction: column; gap: 16px;
  }
  .ad-cta {
    align-self: flex-start;
    display: inline-flex; align-items: center; gap: 10px;
    padding: 18px 32px;
    background: linear-gradient(135deg, ${MEDPAY_TEAL} 0%, ${MEDPAY_TEAL_2} 100%);
    color: #fff;
    border-radius: 999px;
    font-size: 22px; font-weight: 700;
    letter-spacing: -0.01em;
    box-shadow: 0 18px 40px -12px rgba(34, 184, 160, 0.55);
  }
  .ad-discl {
    font-size: 11px; line-height: 1.5;
    color: rgba(255, 255, 255, 0.50);
    max-width: 940px;
  }

  .ad-variant-stamp {
    position: absolute;
    top: 28px; right: 56px;
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 9px; letter-spacing: 0.20em; font-weight: 700;
    color: rgba(255, 255, 255, 0.16);
    text-transform: uppercase;
    pointer-events: none;
  }

  /* shared component vocabulary */
  .ad-h1 {
    font-size: 88px; font-weight: 800;
    letter-spacing: -0.04em; line-height: 1.02;
    margin: 0 0 24px;
  }
  .ad-h1 em {
    font-style: normal; font-weight: 800;
    background: linear-gradient(135deg, ${MEDPAY_TEAL_2} 0%, #fff 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .ad-h1-sm { font-size: 64px; }
  .ad-sub {
    font-size: 26px; line-height: 1.4;
    color: rgba(255, 255, 255, 0.78);
    max-width: 840px;
    margin: 0;
  }
`;
