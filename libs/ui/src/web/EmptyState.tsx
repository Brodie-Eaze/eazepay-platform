import type { FC, ReactNode } from 'react';
import { cn } from './cn';

export const EmptyState: FC<{
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}> = ({ title, description, action, icon, className }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center px-6 py-14 rounded-lg border border-dashed border-border bg-bg-elevated/30',
      className,
    )}
  >
    {icon && (
      <div className="size-12 rounded-full bg-bg-muted flex items-center justify-center text-fg-muted mb-4">
        {icon}
      </div>
    )}
    <h3 className="text-[15px] font-semibold">{title}</h3>
    {description && <p className="mt-1 text-[13px] text-fg-muted max-w-md">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
