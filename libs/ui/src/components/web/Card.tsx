import { type FC, type HTMLAttributes } from 'react';
import { colorsForTheme, radius, spacing, type ThemeMode } from '../../tokens/index';

export const Card: FC<HTMLAttributes<HTMLDivElement> & { theme?: ThemeMode; padded?: boolean }> = ({
  theme = 'light',
  padded = true,
  style,
  children,
  ...rest
}) => {
  const c = colorsForTheme(theme);
  return (
    <div
      {...rest}
      style={{
        backgroundColor: c.bgElevated,
        border: `1px solid ${c.borderDefault}`,
        borderRadius: radius.xl,
        padding: padded ? spacing.xl : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
