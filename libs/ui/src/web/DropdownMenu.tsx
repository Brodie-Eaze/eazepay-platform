'use client';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { cn } from './cn';

/**
 * Tailwind-styled dropdown built on Radix `DropdownMenu` primitives.
 *
 * Composition mirrors Radix's compound-component shape so existing
 * Radix patterns (focus management, keyboard nav, portal escape,
 * scroll lock) just work. Tokens come from our design system —
 * `--bg-elevated`, `--border`, `--fg`, `--accent`.
 */

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;
export const DropdownMenuGroup = RadixDropdown.Group;
export const DropdownMenuPortal = RadixDropdown.Portal;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof RadixDropdown.Content>,
  ComponentPropsWithoutRef<typeof RadixDropdown.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <RadixDropdown.Portal>
    <RadixDropdown.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[200px] overflow-hidden rounded-md border border-border bg-bg-elevated p-1 shadow-md',
        'data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  </RadixDropdown.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof RadixDropdown.Item>,
  ComponentPropsWithoutRef<typeof RadixDropdown.Item> & { variant?: 'default' | 'danger' }
>(({ className, variant = 'default', ...props }, ref) => (
  <RadixDropdown.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none transition-colors',
      'focus:bg-bg-muted focus:text-fg data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      variant === 'danger' && 'text-danger focus:bg-danger-bg focus:text-danger',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof RadixDropdown.Label>,
  ComponentPropsWithoutRef<typeof RadixDropdown.Label>
>(({ className, ...props }, ref) => (
  <RadixDropdown.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold text-fg-muted',
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof RadixDropdown.Separator>,
  ComponentPropsWithoutRef<typeof RadixDropdown.Separator>
>(({ className, ...props }, ref) => (
  <RadixDropdown.Separator
    ref={ref}
    className={cn('my-1 h-px bg-border', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export const DropdownMenuShortcut = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <span className={cn('ml-auto text-[11px] tracking-widest text-fg-muted', className)}>
    {children}
  </span>
);
