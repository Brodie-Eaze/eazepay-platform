import type { FC, SVGProps } from 'react';

/**
 * Hand-built SVG icon set. We deliberately do not depend on lucide-
 * react in the shared lib so that the lib stays free of React-version-
 * specific transitive deps. Apps can add lucide locally if they want a
 * wider set; these cover navigation, status, and lender-orchestration
 * concepts.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

export const HomeIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  </svg>
);
export const QueueIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
export const RouteIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="18" r="2" />
    <path d="M7 6h6a4 4 0 0 1 4 4v0a4 4 0 0 0 4 4" />
  </svg>
);
export const ShieldIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
  </svg>
);
export const BoltIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M13 3 4 14h6l-1 7 9-11h-6z" />
  </svg>
);
export const DollarIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3v18M16 7H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H8" />
  </svg>
);
export const ChartIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 21h18M7 17V10M12 17V5M17 17v-8" />
  </svg>
);
export const UsersIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 11a3 3 0 1 0-2-5.5" />
    <path d="M21 19a5 5 0 0 0-3-4.5" />
  </svg>
);
export const SettingsIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const KeyIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="7" cy="15" r="3" />
    <path d="M10 13 22 1l-3 3M16 7l3 3" />
  </svg>
);
export const PackageIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </svg>
);
export const WebhookIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M10 14l5-9" />
    <path d="M14 5a3 3 0 1 1 5 3l-3 5" />
    <circle cx="6" cy="18" r="3" />
    <path d="M9 18h9a3 3 0 0 0 0-6" />
  </svg>
);
export const SearchIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const DocIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </svg>
);
export const FlagIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 21V4h13l-2 4 2 4H4" />
  </svg>
);
export const CheckIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);
export const MenuIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
export const XIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M6 6l12 12M18 6l-12 12" />
  </svg>
);
export const ArrowRightIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ChevronDownIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const ClockIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const ExternalIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M14 4h6v6M20 4 10 14" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
);
export const CopyIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
export const LinkIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M9 15a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M15 9a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
);
export const AlertIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3 2 21h20z" />
    <path d="M12 10v5M12 18v.5" />
  </svg>
);
export const InfoIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v.5M12 11v6" />
  </svg>
);
export const SparkIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3v6M12 15v6M3 12h6M15 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4" />
  </svg>
);
export const BankIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 10 12 4l9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18" />
  </svg>
);
/** Speedometer / dashboard gauge — used for the Command Center nav item. */
export const GaugeIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 14l4-4" />
    <path d="M3.5 14a9 9 0 1 1 17 0" />
    <circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);
/** Paper-plane / send. Used for the "EAZE Pay Application" intake item. */
export const SendIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4z" />
  </svg>
);
/** Heart with a pulse line — Med Pay. */
export const HeartPulseIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 12 5.86 5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z" />
    <path d="M3.22 12H9l1-2 3 6 1-3h6.78" fill="none" />
  </svg>
);
/** Phone handset — DialerPay. */
export const PhoneIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
/** Crown — EAZE Pay (premium consumer product). */
export const CrownIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M2 18h20l-2-9-4 3-4-7-4 7-4-3z" />
    <path d="M2 21h20" />
  </svg>
);
/** Credit-card rectangle — EAZE Processing. */
export const CardIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20M6 15h4" />
  </svg>
);
/** Storefront — Marketplace Listings. */
export const StoreIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 9h18l-1.5-5h-15z" />
    <path d="M4 9v11h16V9" />
    <path d="M9 20v-6h6v6" />
  </svg>
);
/** Robot head — EAZE AI. */
export const RobotIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <rect x="4" y="7" width="16" height="12" rx="2" />
    <path d="M12 3v4" />
    <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
    <path d="M9 17h6" />
  </svg>
);
/** Up-and-to-the-right arrow for trend deltas. */
export const TrendUpIcon: FC<IconProps> = ({ size = 14, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M7 17 17 7" />
    <path d="M9 7h8v8" />
  </svg>
);
/** Down-and-to-the-right arrow for negative trend deltas. */
export const TrendDownIcon: FC<IconProps> = ({ size = 14, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M7 7 17 17" />
    <path d="M17 9v8h-8" />
  </svg>
);
/** Trophy — Partner Leaderboard rank #1. */
export const TrophyIcon: FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v6a5 5 0 0 1-10 0z" />
    <path d="M17 4h3v2a3 3 0 0 1-3 3" />
    <path d="M7 4H4v2a3 3 0 0 0 3 3" />
  </svg>
);
