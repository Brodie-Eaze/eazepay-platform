'use client';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { cn } from './cn';

/**
 * Image avatar with lettered fallback. Built on Radix Avatar.
 *
 *   <Avatar>
 *     <AvatarImage src="/me.png" alt="Maya Chen" />
 *     <AvatarFallback>MC</AvatarFallback>
 *   </Avatar>
 */
export const Avatar = forwardRef<
  ElementRef<typeof RadixAvatar.Root>,
  ComponentPropsWithoutRef<typeof RadixAvatar.Root> & { size?: number }
>(({ className, size = 36, style, ...props }, ref) => (
  <RadixAvatar.Root
    ref={ref}
    className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full', className)}
    style={{ width: size, height: size, ...style }}
    {...props}
  />
));
Avatar.displayName = 'Avatar';

export const AvatarImage = forwardRef<
  ElementRef<typeof RadixAvatar.Image>,
  ComponentPropsWithoutRef<typeof RadixAvatar.Image>
>(({ className, ...props }, ref) => (
  <RadixAvatar.Image
    ref={ref}
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
));
AvatarImage.displayName = 'AvatarImage';

export const AvatarFallback = forwardRef<
  ElementRef<typeof RadixAvatar.Fallback>,
  ComponentPropsWithoutRef<typeof RadixAvatar.Fallback>
>(({ className, ...props }, ref) => (
  <RadixAvatar.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center bg-accent text-accent-fg font-semibold text-[12px]',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = 'AvatarFallback';
