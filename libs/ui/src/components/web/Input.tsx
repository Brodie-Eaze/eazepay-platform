import { forwardRef, type InputHTMLAttributes } from 'react';
import { colorsForTheme, radius, spacing, type ThemeMode } from '../../tokens/index.js';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  errorText?: string;
  theme?: ThemeMode;
}

/**
 * Text/number input with label, helper, and error states. The error
 * is announced via aria-invalid + aria-describedby. Touch-target
 * height is 44px+ on all sizes (mobile WCAG).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, errorText, theme = 'light', id, style, ...rest },
  ref,
) {
  const c = colorsForTheme(theme);
  const fieldId = id ?? `field-${rest.name ?? 'x'}-${Math.random().toString(36).slice(2, 8)}`;
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
      {label ? (
        <label htmlFor={fieldId} style={{ color: c.textPrimary, fontSize: 14, fontWeight: 600 }}>
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        ref={ref}
        id={fieldId}
        aria-invalid={errorText ? true : undefined}
        aria-describedby={errorText ? errorId : helper ? helperId : undefined}
        style={{
          appearance: 'none',
          height: 44,
          padding: `0 ${spacing.lg}px`,
          fontSize: 16,
          color: c.textPrimary,
          backgroundColor: c.bgDefault,
          border: `1px solid ${errorText ? c.dangerFg : c.borderDefault}`,
          borderRadius: radius.md,
          outline: 'none',
          ...style,
        }}
      />
      {errorText ? (
        <span id={errorId} style={{ color: c.dangerFg, fontSize: 12 }}>
          {errorText}
        </span>
      ) : helper ? (
        <span id={helperId} style={{ color: c.textMuted, fontSize: 12 }}>
          {helper}
        </span>
      ) : null}
    </div>
  );
});
