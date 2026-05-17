import type { FC, ReactNode } from 'react';
import { cn } from './cn';
import { CheckIcon } from './Icon';

/**
 * Horizontal stepper used in onboarding + consumer apply flow.
 * Each step renders a numbered dot or check (for completed steps).
 */
export interface StepperItem {
  key: string;
  label: ReactNode;
  description?: ReactNode;
}

export const Stepper: FC<{
  items: StepperItem[];
  activeIndex: number;
  className?: string;
}> = ({ items, activeIndex, className }) => (
  <ol className={cn('flex items-start w-full', className)}>
    {items.map((item, i) => {
      const isDone = i < activeIndex;
      const isActive = i === activeIndex;
      return (
        <li key={item.key} className="flex-1 flex items-start gap-3 min-w-0">
          <div className="flex flex-col items-center min-w-[28px]">
            <div
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-[12px] font-semibold',
                isDone && 'bg-accent text-accent-fg',
                isActive && 'bg-accent text-accent-fg ring-4 ring-accent-soft',
                !isDone && !isActive && 'bg-bg-muted text-fg-muted border border-border',
              )}
            >
              {isDone ? <CheckIcon size={14} /> : i + 1}
            </div>
            {i < items.length - 1 && (
              <div
                className={cn('h-7 w-px mt-1 hidden md:hidden', isDone ? 'bg-accent' : 'bg-border')}
              />
            )}
          </div>
          <div className="pb-6 pr-4 min-w-0 flex-1">
            <div
              className={cn(
                'text-[13px] font-medium leading-tight',
                isActive || isDone ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {item.label}
            </div>
            {item.description && (
              <div className="text-[12px] text-fg-muted mt-0.5 leading-snug">
                {item.description}
              </div>
            )}
          </div>
          {i < items.length - 1 && (
            <div
              className={cn(
                'flex-1 h-px mt-3.5 hidden lg:block',
                isDone ? 'bg-accent' : 'bg-border',
              )}
            />
          )}
        </li>
      );
    })}
  </ol>
);
