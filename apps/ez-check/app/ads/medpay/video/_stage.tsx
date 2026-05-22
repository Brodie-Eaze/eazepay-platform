/**
 * 1080×1920 vertical stage for kinetic-typography video ads.
 *
 * Children render inside an absolutely-positioned canvas so each
 * variant page can chain CSS @keyframes with delays for tight beat
 * timing without React state. Designed to be Playwright-recorded
 * at 30fps for 15s.
 */
import type { ReactNode } from 'react';

export const TEAL = '#0E7C66';
export const TEAL_2 = '#22B8A0';
export const DEEP = '#062C29';
export const INK = '#0A1F1D';

export function VideoStage({ children, css }: { children: ReactNode; css: string }) {
  return (
    <div className="vs-root">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
            .vs-root {
              width: 1080px; height: 1920px;
              background: #000;
              -webkit-font-smoothing: antialiased;
              overflow: hidden;
              position: relative;
            }
            .vs-canvas {
              position: relative;
              width: 1080px; height: 1920px;
              background:
                radial-gradient(ellipse 60% 50% at 20% 10%, rgba(34, 184, 160, 0.34) 0%, transparent 60%),
                radial-gradient(ellipse 50% 60% at 85% 90%, rgba(14, 124, 102, 0.40) 0%, transparent 55%),
                linear-gradient(180deg, ${DEEP} 0%, #03100E 100%);
              overflow: hidden;
            }
            .vs-mesh {
              position: absolute; inset: 0;
              background:
                radial-gradient(ellipse 70% 50% at 50% 0%, rgba(34, 184, 160, 0.22), transparent 60%),
                radial-gradient(ellipse 60% 70% at 50% 100%, rgba(34, 184, 160, 0.18), transparent 60%);
              animation: vs-mesh 8s ease-in-out infinite;
            }
            @keyframes vs-mesh {
              0%, 100% { transform: translate(0, 0) scale(1); }
              50% { transform: translate(-30px, 30px) scale(1.06); }
            }
            .vs-grain {
              position: absolute; inset: 0;
              background-image:
                linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
              background-size: 56px 56px;
              mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
              pointer-events: none;
            }
            /* Reusable beat keyframes — every variant page imports these */
            @keyframes vs-in-up {
              0% { opacity: 0; transform: translateY(40px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes vs-in-down {
              0% { opacity: 0; transform: translateY(-40px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes vs-in-scale {
              0% { opacity: 0; transform: scale(0.85); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes vs-in-blur {
              0% { opacity: 0; filter: blur(20px); transform: translateY(20px); }
              100% { opacity: 1; filter: blur(0); transform: translateY(0); }
            }
            @keyframes vs-out-up {
              0% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(-30px); }
            }
            @keyframes vs-out-blur {
              0% { opacity: 1; filter: blur(0); }
              100% { opacity: 0; filter: blur(16px); }
            }
            @keyframes vs-pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.04); }
            }
            @keyframes vs-glow {
              0%, 100% { box-shadow: 0 0 0 0 rgba(34, 184, 160, 0.55); }
              50% { box-shadow: 0 0 60px 12px rgba(34, 184, 160, 0.55); }
            }
            .vs-fade { opacity: 0; animation-fill-mode: forwards; }
            ${css}
          `,
        }}
      />
      <div className="vs-canvas">
        <div className="vs-mesh" aria-hidden />
        <div className="vs-grain" aria-hidden />
        {children}
      </div>
    </div>
  );
}
