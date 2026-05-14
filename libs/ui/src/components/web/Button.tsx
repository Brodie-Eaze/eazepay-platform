import { type ButtonHTMLAttributes, type FC } from 'react';
import { colorsForTheme, radius, spacing, type ThemeMode } from '../../tokens/index';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Theme mode the button renders in. Default 'light'; consumers
   *  pass through their app theme. */
  theme?: ThemeMode;
}

const sizeStyles: Record<Size, { paddingY: number; paddingX: number; fontSize: number }> = {
  sm: { paddingY: spacing.xs, paddingX: spacing.md, fontSize: 14 },
  md: { paddingY: spacing.sm, paddingX: spacing.lg, fontSize: 16 },
  lg: { paddingY: spacing.md, paddingX: spacing.xl, fontSize: 18 },
};

/**
 * Semantic Button. Renders a native <button> with platform-default
 * keyboard + screen reader behavior. Variants map to design tokens;
 * loading is announced via aria-busy.
 */
export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  theme = 'light',
  disabled,
  children,
  style,
  ...rest
}) => {
  const colors = colorsForTheme(theme);
  const ss = sizeStyles[size];
  const palette = paletteFor(variant, colors);
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{
        appearance: 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        backgroundColor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        padding: `${ss.paddingY}px ${ss.paddingX}px`,
        fontSize: ss.fontSize,
        fontWeight: 600,
        lineHeight: 1.2,
        transitionDuration: '120ms',
        ...style,
      }}
    >
      {loading ? '…' : children}
    </button>
  );
};

function paletteFor(
  variant: Variant,
  c: ReturnType<typeof colorsForTheme>,
): { bg: string; fg: string; border: string } {
  switch (variant) {
    case 'primary':
      return { bg: c.accentDefault, fg: c.textOnAccent, border: c.accentDefault };
    case 'secondary':
      return { bg: c.bgElevated, fg: c.textPrimary, border: c.borderDefault };
    case 'tertiary':
      return { bg: 'transparent', fg: c.accentDefault, border: 'transparent' };
    case 'destructive':
      return { bg: c.dangerFg, fg: '#FFFFFF', border: c.dangerFg };
    case 'ghost':
      return { bg: 'transparent', fg: c.textPrimary, border: 'transparent' };
  }
}
