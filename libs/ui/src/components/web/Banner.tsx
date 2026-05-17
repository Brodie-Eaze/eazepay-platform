import { type FC, type ReactNode } from 'react';
import { colorsForTheme, radius, spacing, type ThemeMode } from '../../tokens/index';

type Intent = 'info' | 'success' | 'warning' | 'danger';

interface BannerProps {
  intent: Intent;
  title: string;
  children?: ReactNode;
  theme?: ThemeMode;
}

export const Banner: FC<BannerProps> = ({ intent, title, children, theme = 'light' }) => {
  const c = colorsForTheme(theme);
  const palette = paletteFor(intent, c);
  return (
    <div
      role="alert"
      style={{
        backgroundColor: palette.bg,
        color: palette.fg,
        borderRadius: radius.lg,
        padding: spacing.lg,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: spacing.xs }}>{title}</div>
      {children ? <div style={{ fontSize: 14, lineHeight: 1.5 }}>{children}</div> : null}
    </div>
  );
};

function paletteFor(
  intent: Intent,
  c: ReturnType<typeof colorsForTheme>,
): { bg: string; fg: string } {
  switch (intent) {
    case 'info':
      return { bg: c.infoBg, fg: c.infoFg };
    case 'success':
      return { bg: c.successBg, fg: c.successFg };
    case 'warning':
      return { bg: c.warningBg, fg: c.warningFg };
    case 'danger':
      return { bg: c.dangerBg, fg: c.dangerFg };
  }
}
