'use client';
import { CheckIcon } from '@eazepay/ui/web';
import { INDUSTRIES, type Industry, type StepProps } from './state';

/**
 * Step 1 — Industry. Four large clickable cards. The selected card
 * flips to dark-navy fill with a check pill. Mirrors the Lovable
 * welcome step exactly.
 */
export default function StepIndustry({ state, setState, errors }: StepProps) {
  return (
    <div className="space-y-3">
      {INDUSTRIES.map((opt) => {
        const active = state.industry === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setState((s) => ({ ...s, industry: opt.code as Industry }))}
            className={
              'w-full text-left rounded-xl border px-5 py-4 transition-all flex items-start gap-4 ' +
              (active
                ? 'bg-[#0d1530] border-[#0d1530] text-white shadow-md'
                : 'bg-bg-elevated border-border hover:border-border-strong')
            }
          >
            <div className="flex-1 min-w-0">
              <div className={'text-[15px] font-semibold ' + (active ? 'text-white' : 'text-fg')}>
                {opt.title}
              </div>
              <div
                className={
                  'text-[13px] mt-1 leading-relaxed ' + (active ? 'text-white/70' : 'text-fg-muted')
                }
              >
                {opt.description}
              </div>
            </div>
            {active && (
              <span className="h-6 w-6 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5">
                <CheckIcon size={14} className="text-[#0d1530]" />
              </span>
            )}
          </button>
        );
      })}
      {errors['industry'] && (
        <p className="text-[12px] text-fg font-semibold mt-2">{errors['industry']}</p>
      )}
    </div>
  );
}
