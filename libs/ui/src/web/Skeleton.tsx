import type { FC } from 'react';
import { cn } from './cn';

export const Skeleton: FC<{ className?: string; rows?: number }> = ({ className, rows = 1 }) => {
  if (rows === 1) {
    return <div className={cn('shimmer rounded h-4 w-full', className)} />;
  }
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="shimmer rounded h-4" style={{ width: `${100 - i * 8}%` }} />
      ))}
    </div>
  );
};
