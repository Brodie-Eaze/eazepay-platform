'use client';
import type { ReactNode } from 'react';
import { useMemo, useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AppShell,
  Button,
  CommandPalette,
  type CommandPaletteCommand,
  StatusPill,
  HomeIcon,
  QueueIcon,
  ChartIcon,
  PackageIcon,
  DollarIcon,
  KeyIcon,
  WebhookIcon,
  BoltIcon,
  DocIcon,
  SettingsIcon,
  ChevronDownIcon,
  UsersIcon,
  ShieldIcon,
  BankIcon,
  SparkIcon,
  RouteIcon,
  FlagIcon,
  ArrowRightIcon,
  LinkIcon,
  AlertIcon,
  GaugeIcon,
  SendIcon,
  HeartPulseIcon,
  PhoneIcon,
  CrownIcon,
  CardIcon,
  StoreIcon,
  RobotIcon,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  type NavGroup,
} from '@eazepay/ui/web';
import { BRAND_ORDER, BRANDS, type BrandCode } from '@eazepay/shared-types';
import { partnerOrg } from '../lib/mock-data';
import { LiveActivityStrip } from '../components/LiveActivityStrip';
import { NotificationBell } from '../components/NotificationBell';
import { partners as MASTER_PARTNERS_ROSTER } from '../lib/master-data';
import { marketplaceLenders } from '../lib/marketplace-data';

/**
 * Map a per-brand portal to the notification recipient key — the
 * partner merchantId. The demo signs every brand portal in as the
 * FIRST roster partner for that brand (matches the BillingTab demo
 * pattern in /v/[brand]/billing). When real auth lands, swap this
 * for the merchantId resolved from the JWT.
 */
function notificationRecipientForBrand(brand: BrandCode): string {
  const brandName = BRANDS[brand].name.toLowerCase();
  const partner = MASTER_PARTNERS_ROSTER.find((p) => p.product.toLowerCase() === brandName);
  return partner?.id ?? `partner_${brand}`;
}

const NextLink = ({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);

/**
 * Master Command Centre menu — restructured into clear sections so an
 * operator never has to scan a 24-item flat list. Each group answers a
 * specific job-to-be-done:
 *
 *   COMMAND CENTRE — overview + executive control
 *   PIPELINE       — day-to-day operational queue
 *   LENDER INTEGRATIONS — registry, per-partner access, routing, events
 *   SUBMIT APPLICATION  — the three brand application forms
 *   PRODUCTS       — the configurable product surfaces partners adopt
 *   SERVICES       — agency-style services (marketing / sales / affiliate)
 *   DEVELOPER      — docs, sandbox, API keys
 *   ACCOUNT        — AI assistant + settings
 *
 * Lender Integrations is the section explicitly carved out — every
 * lender-orchestration knob lives here so it's findable from the menu
 * rather than buried inside "Integrations" with non-lender tools.
 */
const masterGroups: NavGroup[] = [
  {
    label: 'Command Centre',
    items: [
      { href: '/', label: 'Command Center', icon: <GaugeIcon /> },
      { href: '/control-panel', label: 'Control Panel', icon: <SettingsIcon /> },
      { href: '/reports', label: 'Reports', icon: <ChartIcon /> },
      { href: '/insights', label: 'Insights', icon: <SparkIcon /> },
    ],
  },
  {
    // "Partners" is the front-of-house section for every partner-facing
    // operation: their initial onboarding (the pipeline) and the live
    // directory of approved partners. Merchant Approvals previously
    // lived as a separate menu — it duplicated the pipeline's approve
    // step, so it now lives inside Business Onboarding itself.
    label: 'Partners',
    items: [
      { href: '/onboarding-pipeline', label: 'Business Onboarding', icon: <SendIcon /> },
      { href: '/partners', label: 'Partner Directory', icon: <UsersIcon /> },
    ],
  },
  {
    // Pipeline now carries Billing only — the platform invoices merchants
    // for the platform-fee % on funded volume (varies by vertical). The
    // /invoices workspace is a 3-tab Monthly/Collections/Automation page.
    // /payouts deep-links here so old bookmarks still resolve.
    //
    // 2026-05 reorder: "All Applications" moved into the Submit
    // Application group so the application surfaces (submit + queue)
    // are visually adjacent. /applications still works at its direct
    // URL for anyone with the deep link.
    label: 'Pipeline',
    items: [{ href: '/invoices', label: 'Billing', icon: <DollarIcon /> }],
  },
  {
    // Lender Network is intentionally two items:
    //   - "Lender Network" is the catalog (was Marketplaces + Lender Panel —
    //     consolidated because they were two views of the same data).
    //   - "Partner Access" is the override grid: which lenders does each
    //     partner actually see, with reset-to-default + toggle controls.
    // Operations chrome (routing queues, DLQ, webhooks, lender events) lives
    // at its own routes and isn't surfaced here.
    label: 'Lender Network',
    items: [
      { href: '/lender-marketplace', label: 'Lender Network', icon: <BankIcon /> },
      { href: '/lender-marketplace/access', label: 'Partner Access', icon: <KeyIcon /> },
    ],
  },
  {
    // 2026-05 reorder: "All Applications" lives at the top of this
    // group now, alongside the per-brand application links. Keeps the
    // "show me apps / submit an app" surface visually together.
    label: 'Submit Application',
    items: [
      { href: '/applications', label: 'All Applications', icon: <DocIcon /> },
      { href: '/submit/coach-pay', label: 'CoachPay Application', icon: <SendIcon /> },
      { href: '/submit/med-pay', label: 'MedPay Application', icon: <HeartPulseIcon /> },
      { href: '/submit/trade-pay', label: 'TradePay Application', icon: <BankIcon /> },
    ],
  },
  {
    label: 'Products',
    items: [
      { href: '/coach-pay', label: 'CoachPay', icon: <CrownIcon /> },
      { href: '/trade-pay', label: 'TradePay', icon: <BankIcon /> },
      { href: '/eaze-med-pay', label: 'MedPay', icon: <HeartPulseIcon /> },
      { href: '/eaze-processing', label: 'EAZE Processing', icon: <CardIcon /> },
      { href: '/dialerpay', label: 'DialerPay', icon: <PhoneIcon /> },
      { href: '/ez-check', label: 'EZ Check', icon: <ShieldIcon /> },
    ],
  },
  {
    label: 'Services',
    items: [
      { href: '/eaze-affiliate', label: 'EAZE Affiliate', icon: <SparkIcon /> },
      { href: '/marketing-consult', label: 'Marketing Consult', icon: <BoltIcon /> },
      { href: '/sales-recruitment', label: 'Sales Recruitment', icon: <UsersIcon /> },
      { href: '/marketplace', label: 'Marketplace', icon: <StoreIcon /> },
      {
        href: 'https://amalafoundation.org/',
        label: 'AMALA Foundation',
        icon: <ArrowRightIcon size={14} />,
      },
    ],
  },
  {
    label: 'Developer',
    items: [
      { href: '/docs', label: 'Documentation', icon: <DocIcon /> },
      { href: '/sandbox', label: 'Sandbox', icon: <FlagIcon /> },
      { href: '/api-keys', label: 'API Keys', icon: <KeyIcon /> },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/eaze-ai', label: 'EAZE AI', icon: <RobotIcon /> },
      { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
    ],
  },
];

/**
 * Admin (platform-engineering) menu — the third top-level alongside
 * `masterGroups` and `verticalGroups`. Surfaces the platform-config /
 * platform-health pages that the ship-ready loop dropped in last week:
 * vertical config, provisioning queue, AI-funding migrations, the
 * platform audit log, observability, SLOs, and the lender marketplace
 * deep-dive.
 *
 * Why a third top-level rather than an 8th section appended to
 * `masterGroups`?
 *
 *  1. The master menu already runs 9 sections deep — adding admin items
 *     to it pushes Account off-screen on a 1080p laptop. Operators
 *     would lose the muscle memory of "Account is bottom-left".
 *  2. Admin pages are a different job-to-be-done than the master
 *     command centre. Master = "run the business this morning"
 *     (pipeline, partners, invoices). Admin = "tune the platform"
 *     (provisioning, observability, audit). The context switch is
 *     real; surfacing it in the sidebar makes the mental model
 *     visible instead of forcing the operator to URL-type.
 *  3. The shell already swaps `groups` based on path (master vs
 *     vertical). Adding a third arm of the same switch is the
 *     cheapest, most-symmetric extension.
 *
 * Trigger: any pathname starting with `/admin` or `/lender-marketplace`
 * (the lender deep-dive is the one non-/admin page in the admin pack).
 * Resolved in `Shell()` below.
 */
const adminGroups: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { href: '/admin', label: 'Control Plane', icon: <SettingsIcon /> },
      { href: '/admin/observability', label: 'Observability', icon: <GaugeIcon /> },
      { href: '/admin/observability/slo', label: 'SLO Board', icon: <ChartIcon /> },
      { href: '/admin/audit', label: 'Audit Log', icon: <DocIcon /> },
    ],
  },
  {
    label: 'Provisioning',
    items: [
      { href: '/admin/provisioning', label: 'Provisioning Queue', icon: <QueueIcon /> },
      { href: '/admin/provisioning/new', label: 'New Provisioning', icon: <SendIcon /> },
    ],
  },
  {
    label: 'Verticals',
    items: [{ href: '/admin/verticals/medpay', label: 'MedPay Config', icon: <HeartPulseIcon /> }],
  },
  {
    label: 'Migrations',
    items: [
      {
        href: '/admin/migrations/ai-funding',
        label: 'AI Funding Cutover',
        icon: <BoltIcon />,
      },
    ],
  },
  {
    label: 'Lender Network',
    items: [{ href: '/lender-marketplace', label: 'Marketplace', icon: <BankIcon /> }],
  },
  {
    label: 'Back to Master',
    items: [{ href: '/', label: 'Command Center', icon: <GaugeIcon /> }],
  },
];

const ADMIN_PATH_PREFIXES = ['/admin', '/lender-marketplace'];
const isAdminPath = (pathname: string): boolean =>
  ADMIN_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

/**
 * Per-brand partner menu — scoped to a single vertical. A TradePay
 * partner sees only the TradePay submit-application item, never the
 * Med Pay or EAZE Pay variants. The link rendered on the submit page
 * is partner-unique (carries `?ref=<partnerSlug>`) so every signed
 * client click maps back to the partner in the master command centre.
 *
 * Per-brand Integrations section: every partner can configure their
 * brand-specific Processing (acquiring rail), EZ Check (soft-pull
 * pre-qual), and DialerPay (outbound dialler) inside their portal —
 * the brand prefix in each label keeps it clear which vertical the
 * integration is wired to (eg. "MedPay Processing" vs "TradePay
 * Processing").
 */
const verticalGroups = (brand: BrandCode): NavGroup[] => {
  const b = BRANDS[brand];
  const base = `/v/${b.slug}`;
  const brandSubmitLabel =
    brand === 'medpay'
      ? 'MedPay Application'
      : brand === 'tradepay'
        ? 'TradePay Application'
        : brand === 'coachpay'
          ? 'CoachPay Application'
          : 'Application';
  const brandSubmitIcon =
    brand === 'medpay' ? <HeartPulseIcon /> : brand === 'tradepay' ? <BankIcon /> : <SendIcon />;
  return [
    {
      label: 'Overview',
      items: [
        { href: `${base}`, label: 'Home', icon: <HomeIcon /> },
        { href: `${base}/insights`, label: 'Insights', icon: <ChartIcon /> },
      ],
    },
    {
      // 2026-05 reorder: Applications lives alongside Submit + Send
      // Application Link so the "apps I've sent, apps I'm reviewing"
      // surfaces sit together.
      label: 'Submit Application',
      items: [
        { href: `${base}/applications`, label: 'Applications', icon: <DocIcon /> },
        { href: `${base}/submit`, label: brandSubmitLabel, icon: brandSubmitIcon },
        { href: `${base}/send-link`, label: 'Send Application Link', icon: <LinkIcon /> },
      ],
    },
    {
      // Billing stays under Payments — the per-brand merchant doesn't
      // process cards through EazePay (MiCamp handles their gateway
      // separately) so this group is just the platform-fee invoice
      // surface today.
      label: 'Payments',
      items: [{ href: `${base}/billing`, label: 'Billing', icon: <DollarIcon /> }],
    },
    {
      label: 'Integrations',
      items: [
        {
          href: `${base}/integrations/ez-check`,
          label: `EZ Check ${b.name}`,
          icon: <ShieldIcon />,
        },
        {
          href: `${base}/integrations/processing`,
          label: `${b.name} Processing`,
          icon: <CardIcon />,
        },
        {
          href: `${base}/integrations/dialerpay`,
          label: 'DialerPay',
          icon: <PhoneIcon />,
        },
      ],
    },
    {
      // Services — every link is scoped under /v/<brand>/services/ so
      // a partner can never leak back into the master operator's URL
      // space. The per-brand routes render the same shared marketing
      // content as the master pages, but the URL, breadcrumbs, and
      // sidebar stay inside the brand portal.
      label: 'Services',
      items: [
        {
          href: `${base}/services/eaze-affiliate`,
          label: 'Eaze Affiliate',
          icon: <SparkIcon />,
        },
        {
          href: `${base}/services/marketing-consult`,
          label: 'Marketing Consult',
          icon: <BoltIcon />,
        },
        {
          href: `${base}/services/sales-recruitment`,
          label: 'Sales Recruitment',
          icon: <UsersIcon />,
        },
        { href: `${base}/services/marketplace`, label: 'Marketplace', icon: <StoreIcon /> },
      ],
    },
    {
      // API keys are master-operator concerns — not exposed in the merchant-scoped
      // portal. Master operators access keys at /api-keys.
      label: 'Account',
      items: [
        { href: `${base}/team`, label: 'Team & Roles', icon: <UsersIcon /> },
        { href: `${base}/settings`, label: 'Settings', icon: <SettingsIcon /> },
      ],
    },
  ];
};

/** Routes that render their own full-page chrome (no AppShell sidebar). */
const NAKED_ROUTES = [
  '/sign-in',
  '/welcome',
  '/onboarding',
  '/forgot-password',
  '/create-account',
  '/apply', // consumer apply landing — external customers, no sidebar
  '/lenders', // public lender developer hub — prospective lenders, no sidebar
  '/landing', // per-vertical marketing landing pages — public, no sidebar
  '/invoices/confirm', // recipient confirm/dispute page — public, token-gated
  '/accept', // team-invite accept landing — recipient may have no cookie
  '/sales', // sales-team pitch decks (full-screen slide presentations)
  '/medpay', // MedPay flow pages (Landing/Website/Checkout/Success/Onboarding)
  '/tradepay', // TradePay flow pages (Checkout/Onboarding)
  '/coachpay', // CoachPay flow pages (Checkout/Onboarding)
];

const brandFromPath = (pathname: string): BrandCode | null => {
  const match = pathname.match(/^\/v\/([^/]+)/);
  if (!match) return null;
  const slug = match[1];
  const found = BRAND_ORDER.find((b) => BRANDS[b].slug === slug);
  return found ?? null;
};

function BrandSwitcher({ activeBrand }: { activeBrand: BrandCode | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const label = activeBrand ? BRANDS[activeBrand].name : 'Master · all products';
  // Mono palette inside the portal — no brand colours leaking into chrome.
  const labelColor = 'rgb(var(--accent))';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px] font-medium flex items-center gap-2 hover:border-border-strong"
      >
        <span className="size-2 rounded-full" style={{ background: labelColor }} />
        {label}
        <ChevronDownIcon size={14} className="text-fg-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-72 rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className={`block px-3 py-2.5 text-[13px] hover:bg-bg-muted flex items-start gap-2 ${activeBrand === null ? 'bg-bg-muted' : ''}`}
          >
            <span
              className="size-2 rounded-full mt-1.5 shrink-0"
              style={{ background: 'rgb(var(--accent))' }}
            />
            <span className="flex-1">
              <span className="block font-semibold">Master · all products</span>
              <span className="block text-[11px] text-fg-muted leading-snug">
                Cross-vertical command centre
              </span>
            </span>
            {activeBrand === null && (
              <span className="text-[11px] text-fg-muted mt-1.5">Active</span>
            )}
          </Link>
          <div className="h-px bg-border" />
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
            Vertical portals
          </div>
          {BRAND_ORDER.filter((b) => b !== 'direct').map((code) => {
            const b = BRANDS[code];
            const isActive = activeBrand === code;
            return (
              <Link
                key={code}
                href={`/v/${b.slug}`}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 text-[13px] hover:bg-bg-muted flex items-start gap-2 ${isActive ? 'bg-bg-muted' : ''}`}
              >
                <span
                  className="size-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: 'rgb(var(--accent))' }}
                />
                <span className="flex-1">
                  <span className="block font-medium">{b.name}</span>
                  <span className="block text-[11px] text-fg-muted leading-snug">
                    {b.verticals.slice(0, 3).join(' · ')}
                  </span>
                </span>
                {isActive ? (
                  <span className="text-[11px] text-fg-muted mt-1.5">Active</span>
                ) : (
                  <ArrowRightIcon size={12} className="text-fg-muted mt-1.5" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserMenu({ activeBrand }: { activeBrand: BrandCode | null }) {
  const router = useRouter();

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* network error is non-fatal — proceed with client-side teardown */
    } finally {
      router.push('/sign-in');
    }
  };

  // Per-brand account chrome: every link stays inside /v/<brand>/. The
  // master operator's /admin/team, /audit, /security, /help are walled
  // off — a brand merchant never resolves to those routes.
  const base = activeBrand ? `/v/${BRANDS[activeBrand].slug}` : '';
  const settingsHref = activeBrand ? `${base}/settings` : '/settings';
  const teamHref = activeBrand ? `${base}/team` : '/admin/team';
  const activityHref = activeBrand ? `${base}/settings` : '/audit';
  const securityHref = activeBrand ? `${base}/settings` : '/security';
  const helpHref = activeBrand ? `${base}/settings` : '/help';
  const teamLabel = activeBrand ? 'Manage team & roles' : 'Manage internal team';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 pl-3 border-l border-border rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated"
          aria-label="Open user menu"
        >
          <Avatar size={28}>
            <AvatarFallback>EA</AvatarFallback>
          </Avatar>
          <div className="hidden md:block leading-tight text-left">
            <div className="text-[12px] font-medium">EAZE Admin</div>
            <div className="text-[11px] text-fg-muted">admin@eaze.test</div>
          </div>
          <ChevronDownIcon size={12} className="text-fg-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>EAZE Admin</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => router.push(settingsHref)}>
          <SettingsIcon size={14} /> Profile & preferences
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(teamHref)}>
          <UsersIcon size={14} /> {teamLabel}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(activityHref)}>
          <DocIcon size={14} /> My activity log
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(securityHref)}>
          <ShieldIcon size={14} /> Security & 2FA
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(helpHref)}>
          <DocIcon size={14} /> Help & support
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onSelect={signOut}>
          <RouteIcon size={14} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Dev-time guard: when rendering a per-brand portal, every sidebar
 * href MUST start with `/v/<brand>/` (or be an explicitly allow-listed
 * external/protocol link like `https:`, `mailto:`, etc.). This catches
 * regressions where someone adds a nav item that would leak back to
 * the master operating system. Production builds skip the check.
 */
function assertNoMasterLeaks(groups: NavGroup[], brandSlug: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const allowedPrefix = `/v/${brandSlug}/`;
  const allowedExternal = /^(https?:|mailto:|tel:|#)/;
  for (const group of groups) {
    for (const item of group.items) {
      const href = item.href;
      if (!href) continue;
      if (href === `/v/${brandSlug}`) continue;
      if (href.startsWith(allowedPrefix)) continue;
      if (allowedExternal.test(href)) continue;
      // eslint-disable-next-line no-console
      console.error(
        `[partner-portal wall-up] href "${href}" in group "${group.label}" leaks ` +
          `out of /v/${brandSlug}/. Every per-brand nav item must stay inside ` +
          `the partner's portal namespace.`,
      );
    }
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Build the command palette source — every nav target across the
  // three sidebar arrangements + the live lender + partner roster.
  // Hoisted above the NAKED_ROUTES early-return so React Hook order
  // stays stable across renders.
  const paletteCommands = useMemo<CommandPaletteCommand[]>(() => {
    const out: CommandPaletteCommand[] = [];
    const pushGroup = (section: string, gs: NavGroup[]) => {
      for (const g of gs) {
        for (const it of g.items) {
          if (!it.href || /^https?:/.test(it.href)) continue;
          out.push({
            id: `${section}:${it.href}`,
            section,
            label: it.label,
            description: g.label,
            href: it.href,
            icon: it.icon,
          });
        }
      }
    };
    pushGroup('Master', masterGroups);
    pushGroup('Admin', adminGroups);
    pushGroup('MedPay', verticalGroups('medpay'));
    pushGroup('TradePay', verticalGroups('tradepay'));
    pushGroup('CoachPay', verticalGroups('coachpay'));
    for (const l of marketplaceLenders) {
      out.push({
        id: `lender:${l.id}`,
        section: 'Lenders',
        label: l.displayName,
        description: l.legalName,
        href: `/lender-marketplace/${l.id}`,
        icon: <BankIcon size={14} />,
        keywords: [l.legalName, l.externalLenderId],
      });
    }
    for (const p of MASTER_PARTNERS_ROSTER) {
      out.push({
        id: `partner:${p.id}`,
        section: 'Partners',
        label: p.legalName,
        description: `${p.product} · ${p.email}`,
        href: `/control-panel/${p.id}`,
        icon: <UsersIcon size={14} />,
        keywords: [p.email, p.initials],
      });
    }
    return out;
  }, []);

  if (NAKED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return <>{children}</>;
  }

  const activeBrand = brandFromPath(pathname);
  // Three-way sidebar resolution:
  //   1. /v/<brand>/*           → verticalGroups(brand)   (per-brand merchant)
  //   2. /admin/* or /lender-*  → adminGroups             (platform engineering)
  //   3. everything else        → masterGroups            (operator command centre)
  // Admin only resolves when there's no activeBrand — a brand portal
  // never reveals the admin shell, even if a URL collision tried to
  // sneak through.
  const inAdmin = !activeBrand && isAdminPath(pathname);
  const groups = activeBrand ? verticalGroups(activeBrand) : inAdmin ? adminGroups : masterGroups;
  if (activeBrand) assertNoMasterLeaks(groups, BRANDS[activeBrand].slug);
  // Sidebar wordmark + subtitle:
  //   Master view → "EAZE" · "Operating System" (the operating system
  //                  every partner portal connects to)
  //   Brand view  → "Eaze" · "Partner Portal"   (softer mixed-case
  //                  mark for the per-brand merchant; brand identity
  //                  comes through via the env-label pill in the top
  //                  bar, so the wordmark stays consistent across
  //                  all three vertical portals)
  const wordmark = activeBrand ? 'Eaze' : 'EAZE';
  const product = activeBrand ? 'Partner Portal' : inAdmin ? 'Platform Admin' : 'Operating System';
  const envLabel: { label: string; tone: 'live' } = activeBrand
    ? { label: `${BRANDS[activeBrand].name} · Live`, tone: 'live' }
    : inAdmin
      ? { label: 'Live · Admin', tone: 'live' }
      : { label: 'Live · Master', tone: 'live' };

  return (
    <>
      <AppShell
        wordmark={wordmark}
        product={product}
        activePath={pathname}
        groups={groups}
        envLabel={envLabel}
        LinkComponent={NextLink}
        onSearchClick={() => setPaletteOpen(true)}
        searchPlaceholder={
          activeBrand
            ? `Search ${BRANDS[activeBrand].name} applications, partners…`
            : 'Search partners, applications, merchants…'
        }
        topRight={
          <div className="flex items-center gap-3">
            {/* Master-operator chrome — only shown on the master surface (no activeBrand).
              When a merchant is signed in under a specific brand they see a clean
              brand-scoped portal: no cross-brand switcher, no "Vertical view" badge. */}
            {!activeBrand && (
              <>
                <BrandSwitcher activeBrand={activeBrand} />
                <StatusPill tone="success" dot>
                  3 partners awaiting approval
                </StatusPill>
              </>
            )}
            {/* Notification bell — scope = 'master' on operator
              surfaces, partner merchantId on per-brand. Master sees
              a mirror of every notification dispatched from the
              billing send composer; partner sees only their own. */}
            <NotificationBell
              recipient={activeBrand ? notificationRecipientForBrand(activeBrand) : 'master'}
            />
            <Button size="sm" variant="ghost">
              Help
            </Button>
            <UserMenu activeBrand={activeBrand} />
          </div>
        }
        sidebarFooter={
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-fg-secondary uppercase tracking-wider">
              {partnerOrg.displayName}
            </div>
            <div className="leading-snug">
              {activeBrand
                ? `${BRANDS[activeBrand].name} merchant · ${partnerOrg.liveStates} live states`
                : `${partnerOrg.tier} · ${partnerOrg.liveStates} live states`}
            </div>
            <div className="text-[11px] text-fg-muted">
              Member since{' '}
              {new Date(partnerOrg.joinedAt).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>
        }
      >
        {/* Live Activity strip — master operator only. Streams every
          fleet event in real-time. Hidden on per-brand surfaces so
          merchants never see other tenants. */}
        {!activeBrand && <LiveActivityStrip />}
        {children}
      </AppShell>
      {/* Global cmd-K command palette — mounted at the Shell root so
        it's available on every non-naked page. The palette manages
        its own ⌘K hotkey; we pass `open`/`onOpenChange` so the topbar
        search input can also trigger it. */}
      <CommandPalette
        commands={paletteCommands}
        LinkComponent={NextLink}
        onNavigate={(href) => router.push(href)}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </>
  );
}
