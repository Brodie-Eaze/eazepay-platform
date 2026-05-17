'use client';
import type { FC, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { cn } from './cn';
import { Logo } from './Logo';
import { ChevronDownIcon, SearchIcon, MenuIcon, XIcon } from './Icon';

export interface NavItem {
  href: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  /** Optional secondary children rendered under a collapsed group */
  children?: NavItem[];
}

export interface NavGroup {
  /** Section label (e.g. "MASTER"). Rendered in uppercase + muted on the dark sidebar. */
  label?: string;
  items: NavItem[];
}

export const AppShell: FC<{
  children: ReactNode;
  /** Product / tier label shown under the wordmark, e.g. "Partner Portal". */
  product: string;
  groups: NavGroup[];
  /** Currently-active path, used for highlighting. */
  activePath: string;
  /** Right-side topbar slot (user menu, env badge, etc.). */
  topRight?: ReactNode;
  /** Optional searchbox; pass a placeholder string or `false` to hide. */
  searchPlaceholder?: string | false;
  /** Footer for the sidebar — typically the user profile + logout. */
  sidebarFooter?: ReactNode;
  /** Environment label rendered as a chip in the topbar. */
  envLabel?: { label: string; tone?: 'live' | 'sandbox' | 'staging' };
  /** Optional `Link` component (Next.js or plain anchor). Defaults to plain `<a>`. */
  LinkComponent?: FC<{ href: string; className?: string; children: ReactNode }>;
}> = ({
  children,
  product,
  groups,
  activePath,
  topRight,
  searchPlaceholder = 'Search applications, merchants, lenders…',
  sidebarFooter,
  envLabel,
  LinkComponent,
}) => {
  const Link =
    LinkComponent ??
    (((p) => (
      <a href={p.href} className={p.className}>
        {p.children}
      </a>
    )) as FC<{ href: string; className?: string; children: ReactNode }>);

  const envTone =
    envLabel?.tone === 'live'
      ? 'bg-success-bg text-success border-success/30'
      : envLabel?.tone === 'staging'
        ? 'bg-warning-bg text-warning border-warning/30'
        : 'bg-info-bg text-info border-info/30';

  // Mobile drawer state. Closed by default on every render; we open it
  // via the header hamburger and close it on route change (the
  // `activePath` prop changes when the user navigates, which gives us a
  // dependency we can hook into without coupling to a router lib).
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    setDrawerOpen(false);
  }, [activePath]);
  // Lock body scroll while the drawer is open so the underlying page
  // doesn't bounce around when a screen-reader user pans the overlay.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const SidebarContents = (
    <>
      {/* Brand block — compact EAZE wordmark over product subtitle */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2.5 shrink-0">
        <div className="h-9 w-9 rounded-lg bg-white/95 flex items-center justify-center shrink-0 shadow-sm">
          {/* Lightning bolt in dark navy — matches the reference's
              "EAZE Partner Portal" mark. */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#0d1530" aria-hidden>
            <path d="M13 2 4 13h6l-1 9 9-11h-6z" />
          </svg>
        </div>
        <div className="leading-tight min-w-0">
          {/* Wordmark sized to match EazePay Intelligence: 17px,
              semibold (600), tracking-tight. Lighter weight than the
              old extrabold reads more refined alongside the Inter
              stylistic-set glyphs (cv11/ss01) globals.css already
              opts into. */}
          <div className="text-white font-semibold text-[17px] tracking-tight truncate">EAZE</div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-sidebar-fg truncate mt-1">
            {product}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Primary">
        {groups.map((g, gi) => (
          <NavGroupBlock key={gi} group={g} activePath={activePath} Link={Link} />
        ))}
      </nav>

      {sidebarFooter && (
        <div className="px-3 pb-3 pt-2.5 border-t border-white/[0.06] text-[10px] text-sidebar-fg">
          {sidebarFooter}
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Skip-to-main link. First tab stop on every page; styled by the
          `.skip-to-main` class in globals.css. Lands focus on the
          `<main>` element below, jumping past the sidebar and topbar. */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      {/* Persistent sidebar — large screens only */}
      <aside
        aria-label="Primary navigation"
        className="fixed inset-y-0 left-0 z-30 hidden lg:flex w-[228px] shrink-0 flex-col bg-sidebar text-sidebar-fg border-r border-white/[0.06]"
      >
        {SidebarContents}
      </aside>

      {/* Mobile drawer — slides in from the left under `lg`. Backdrop +
          drawer share a single `role="dialog"` so screen-readers
          announce it consistently. */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
        >
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-bg-inverse/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-[260px] max-w-[80vw] flex flex-col bg-sidebar text-sidebar-fg border-r border-white/[0.06] shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute top-3 right-3 inline-flex items-center justify-center h-9 w-9 rounded-md text-white/80 hover:text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <XIcon size={16} />
            </button>
            {SidebarContents}
          </div>
        </div>
      )}

      <div className="flex-1 lg:ml-[228px] flex flex-col min-h-screen min-w-0">
        <header className="h-[52px] border-b border-border bg-bg-elevated flex items-center px-4 sm:px-6 gap-2 sm:gap-3 sticky top-0 z-10">
          {/* Hamburger — visible under `lg`. Min 44x44 hit area as
              required by WCAG 2.5.5 Target Size. */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="primary-nav-drawer"
            className="lg:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 rounded-md text-fg-secondary hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <MenuIcon size={18} />
          </button>
          {searchPlaceholder !== false ? (
            <div className="flex-1 max-w-lg min-w-0">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-bg-muted px-2.5 h-8 text-[12px] text-fg-muted focus-within:bg-bg-elevated focus-within:border-border-strong transition-colors">
                <SearchIcon size={13} />
                <span className="sr-only">Search</span>
                <input
                  placeholder={searchPlaceholder}
                  className="bg-transparent outline-none w-full placeholder:text-fg-muted text-fg"
                  aria-label={typeof searchPlaceholder === 'string' ? searchPlaceholder : 'Search'}
                />
                <kbd className="text-[10px] font-mono text-fg-muted border border-border rounded px-1.5 py-0.5 bg-white hidden sm:inline">
                  ⌘K
                </kbd>
              </label>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            {envLabel && (
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium hidden sm:inline-flex',
                  envTone,
                )}
              >
                {envLabel.label}
              </span>
            )}
            {topRight}
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-auto px-4 sm:px-6 py-5 min-w-0"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

/**
 * Pick the single nav href that should highlight for a given path.
 * Returns the LONGEST href in the tree that matches the active path
 * (either exactly or as a parent prefix) — this is what stops two
 * sibling items like `/lender-marketplace` and `/lender-marketplace/
 * access` from both lighting up when the user is on the deeper one.
 * Only the most-specific match wins.
 */
function pickActiveHref(items: NavItem[], path: string): string | null {
  let bestHref: string | null = null;
  let bestLen = -1;
  const visit = (list: NavItem[]) => {
    for (const it of list) {
      const matches = path === it.href || (it.href !== '/' && path.startsWith(it.href + '/'));
      if (matches && it.href.length > bestLen) {
        bestHref = it.href;
        bestLen = it.href.length;
      }
      if (it.children?.length) visit(it.children);
    }
  };
  visit(items);
  return bestHref;
}

/** True if `target` is `item.href` or any descendant's href. */
function hrefMatchesItemOrChild(item: NavItem, target: string): boolean {
  if (item.href === target) return true;
  if (!item.children?.length) return false;
  return item.children.some((c) => hrefMatchesItemOrChild(c, target));
}

const NavGroupBlock: FC<{
  group: NavGroup;
  activePath: string;
  Link: FC<{ href: string; className?: string; children: ReactNode }>;
}> = ({ group, activePath, Link }) => {
  const [open, setOpen] = useState(true);
  // Single winning href per group — never two siblings active at once.
  const winningHref = pickActiveHref(group.items, activePath);
  return (
    <div className="mb-2.5 pt-1.5">
      {group.label && (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`nav-group-${group.label.replace(/\s+/g, '-').toLowerCase()}`}
          className="w-full px-4 mb-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-sidebar-section-fg hover:text-sidebar-fg flex items-center justify-between"
        >
          <span>{group.label}</span>
          <ChevronDownIcon
            size={9}
            className={cn('transition-transform opacity-60', !open && '-rotate-90')}
            aria-hidden
          />
        </button>
      )}
      {open && (
        <div
          id={
            group.label ? `nav-group-${group.label.replace(/\s+/g, '-').toLowerCase()}` : undefined
          }
          className="space-y-0.5"
        >
          {group.items.map((it) => (
            <NavRow
              key={it.href}
              item={it}
              activePath={activePath}
              winningHref={winningHref}
              Link={Link}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const NavRow: FC<{
  item: NavItem;
  activePath: string;
  /** The single winning href in this group, computed once by
   *  NavGroupBlock. An item is active when its href is the winner OR
   *  one of its descendants is the winner. Sibling prefixes never
   *  highlight, which prevents the historical "two siblings light up"
   *  bug when one href is a string-prefix of the other. */
  winningHref: string | null;
  Link: FC<{ href: string; className?: string; children: ReactNode }>;
}> = ({ item, activePath, winningHref, Link }) => {
  const active = winningHref !== null && hrefMatchesItemOrChild(item, winningHref);
  const [open, setOpen] = useState(active);

  if (item.children?.length) {
    const childrenId = `nav-children-${item.href.replace(/\W+/g, '-')}`;
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={childrenId}
          className={cn(
            // Typography mirrors EazePay Intelligence: 13px,
            // tracking-tight, font-normal default + font-medium
            // active; py-2/rounded-lg padding shape; gap-3 between
            // icon and label.
            'w-full mx-1.5 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] tracking-tight transition-all',
            active
              ? 'bg-white/[0.1] text-white font-medium'
              : 'text-sidebar-fg font-normal hover:bg-white/[0.05] hover:text-slate-200',
          )}
          style={{ width: 'calc(100% - 0.75rem)' }}
        >
          <span className="flex items-center gap-2">
            {item.icon && (
              <span
                className="w-[14px] h-[14px] flex items-center justify-center shrink-0"
                aria-hidden
              >
                {item.icon}
              </span>
            )}
            <span className="text-left">{item.label}</span>
          </span>
          <ChevronDownIcon
            size={11}
            className={cn('transition-transform opacity-60', open && 'rotate-180')}
            aria-hidden
          />
        </button>
        {open && (
          <div
            id={childrenId}
            className="ml-5 mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-2"
          >
            {item.children.map((c) => (
              <NavRow
                key={c.href}
                item={c}
                activePath={activePath}
                winningHref={winningHref}
                Link={Link}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        // Leaf nav row — same typography pattern as the collapsible
        // parent above (13px tracking-tight, font-medium when active,
        // font-normal otherwise, py-2/rounded-lg).
        'mx-1.5 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] tracking-tight transition-all',
        active
          ? 'bg-white/[0.1] text-white font-medium'
          : 'text-sidebar-fg font-normal hover:bg-white/[0.05] hover:text-slate-200',
      )}
    >
      <span className="flex items-center gap-2">
        {item.icon && (
          <span className="w-[14px] h-[14px] flex items-center justify-center shrink-0">
            {item.icon}
          </span>
        )}
        <span>{item.label}</span>
      </span>
      {item.badge != null && (
        <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
          {item.badge}
        </span>
      )}
    </Link>
  );
};

/** Standard page header used inside main content. */
export const PageHeader: FC<{
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}> = ({ title, description, breadcrumbs, actions, meta, className }) => {
  /**
   * Focus the page heading on mount so screen-reader users hear the new
   * page title after each route transition instead of staying on the
   * link they just clicked. `data-page-heading` styles in globals.css
   * suppress the focus ring so this is invisible to sighted users.
   */
  const headingRef = (node: HTMLHeadingElement | null) => {
    if (node && typeof window !== 'undefined') {
      // Skip the very first mount — avoids stealing focus from the
      // sign-in form / external focus origin when the app boots.
      if (document.referrer && document.referrer.startsWith(window.location.origin)) {
        node.focus({ preventScroll: true });
      }
    }
  };
  return (
    <div className={cn('px-4 sm:px-7 pt-5 pb-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-fg-muted font-semibold mb-1.5 flex-wrap"
        >
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {b.href ? (
                <a
                  href={b.href}
                  className="hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 rounded-sm"
                >
                  {b.label}
                </a>
              ) : (
                <span aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}>
                  {b.label}
                </span>
              )}
              {i < breadcrumbs.length - 1 && (
                <span className="text-fg-muted/60" aria-hidden>
                  /
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-3 sm:gap-5 flex-wrap">
        <div className="min-w-0">
          <h1
            ref={headingRef}
            tabIndex={-1}
            data-page-heading
            className="text-[22px] font-semibold leading-tight tracking-tight"
          >
            {title}
          </h1>
          {description && <p className="mt-1 text-[13px] text-fg-muted max-w-3xl">{description}</p>}
          {meta && <div className="mt-2.5 flex items-center gap-2 flex-wrap">{meta}</div>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export const PageBody: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('px-4 sm:px-7 pb-8', className)}>{children}</div>;
