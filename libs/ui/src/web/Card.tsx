import type { FC, ReactNode } from 'react';
import { cn } from './cn';

export const Card: FC<{
  children: ReactNode;
  className?: string;
  padded?: boolean;
  elevated?: boolean;
}> = ({ children, className, padded = false, elevated = false }) => (
  <div
    className={cn(
      'rounded-lg border border-border bg-bg-elevated',
      elevated ? 'shadow-md' : 'shadow-sm',
      padded && 'p-6',
      className,
    )}
  >
    {children}
  </div>
);

export const CardHeader: FC<{
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}> = ({ title, description, action, className }) => (
  <div
    className={cn('flex items-start justify-between gap-4 border-b border-border p-5', className)}
  >
    <div className="min-w-0">
      <h3 className="text-[16px] font-semibold leading-tight">{title}</h3>
      {description && <p className="text-[13px] text-fg-muted mt-1">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardBody: FC<{ children: ReactNode; className?: string; padded?: boolean }> = ({
  children,
  className,
  padded = true,
}) => <div className={cn(padded && 'p-5', className)}>{children}</div>;

export const CardFooter: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'flex items-center justify-end gap-2 border-t border-border bg-bg-muted/40 p-4 rounded-b-lg',
      className,
    )}
  >
    {children}
  </div>
);
