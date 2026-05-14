'use client';
import type { FC, ReactNode } from 'react';
import { cn } from './cn';

export const Tabs: FC<{
  items: Array<{ key: string; label: ReactNode; count?: number }>;
  active: string;
  onChange: (key: string) => void;
  className?: string;
}> = ({ items, active, onChange, className }) => (
  <div className={cn('flex items-center gap-1 border-b border-border', className)}>
    {items.map((it) => {
      const isActive = it.key === active;
      return (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            'relative h-10 px-3 text-[13px] font-medium transition-colors',
            isActive ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {it.label}
            {typeof it.count === 'number' && (
              <span className="text-[11px] bg-bg-muted text-fg-secondary rounded-full px-1.5 py-0.5 tabular-nums">
                {it.count}
              </span>
            )}
          </span>
          {isActive && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>
      );
    })}
  </div>
);
