'use client';
import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import { cn } from './cn';
import { Logo } from './Logo';
import { ChevronDownIcon, SearchIcon } from './Icon';

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

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:flex w-[228px] shrink-0 flex-col bg-sidebar text-sidebar-fg border-r border-white/[0.06]">
        {/* Brand block — compact EAZE wordmark over product subtitle */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 rounded-lg bg-white/95 flex items-center justify-center shrink-0 shadow-sm">
            {/* Lightning bolt in dark navy — matches the reference's
                "EAZE Partner Portal" mark. */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="#0d1530"
              aria-hidden
            >
              <path d="M13 2 4 13h6l-1 9 9-11h-6z" />
            </svg>
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-white font-extrabold text-[16px] tracking-tight truncate">EAZE</div>
            <div className="text-[9px] uppercase tracking-[0.22em] font-semibold text-sidebar-fg truncate mt-0.5">
              {product}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {groups.map((g, gi) => (
            <NavGroupBlock key={gi} group={g} activePath={activePath} Link={Link} />
          ))}
        </nav>

        {sidebarFooter && (
          <div className="px-3 pb-3 pt-2.5 border-t border-white/[0.06] text-[10px] text-sidebar-fg">
            {sidebarFooter}
          </div>
        )}
      </aside>

      <div className="flex-1 lg:ml-[228px] flex flex-col min-h-screen min-w-0">
        <header className="h-[52px] border-b border-border bg-bg-elevated flex items-center px-6 gap-3 sticky top-0 z-10">
          {searchPlaceholder !== false ? (
            <div className="flex-1 max-w-lg">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-muted px-2.5 h-8 text-[12px] text-fg-muted focus-within:bg-bg-elevated focus-within:border-border-strong transition-colors">
                <SearchIcon size={13} />
                <input
                  placeholder={searchPlaceholder}
                  className="bg-transparent outline-none w-full placeholder:text-fg-muted text-fg"
                />
                <kbd className="text-[10px] font-mono text-fg-muted border border-border rounded px-1.5 py-0.5 bg-white">
                  ⌘K
                </kbd>
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-3">
            {envLabel && (
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                  envTone,
                )}
              >
                {envLabel.label}
              </span>
            )}
            {topRight}
          </div>
        </header>
        <main className="flex-1 overflow-auto px-6 py-5 min-w-0">{children}</main>
      </div>
    </div>
  );
};

const NavGroupBlock: FC<{
  group: NavGroup;
  activePath: string;
  Link: FC<{ href: string; className?: string; children: ReactNode }>;
}> = ({ group, activePath, Link }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2.5 pt-1.5">
      {group.label && (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`nav-group-${group.label.replace(/\s+/g, '-').toLowerCase()}`}
          className="w-full px-4 mb-1 text-[9px] uppercase tracking-[0.16em] font-semibold text-sidebar-section-fg hover:text-sidebar-fg flex items-center justify-between"
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
          id={group.label ? `nav-group-${group.label.replace(/\s+/g, '-').toLowerCase()}` : undefined}
          className="space-y-0.5"
        >
          {group.items.map((it) => (
            <NavRow key={it.href} item={it} activePath={activePath} Link={Link} />
          ))}
        </div>
      )}
    </div>
  );
};

const NavRow: FC<{
  item: NavItem;
  activePath: string;
  Link: FC<{ href: string; className?: string; children: ReactNode }>;
}> = ({ item, activePath, Link }) => {
  const active =
    activePath === item.href ||
    (item.href !== '/' && activePath.startsWith(item.href + '/'));
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
            'w-full mx-1.5 flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all',
            active
              ? 'bg-white/[0.1] text-white'
              : 'text-sidebar-fg hover:bg-white/[0.05] hover:text-slate-200',
          )}
          style={{ width: 'calc(100% - 0.75rem)' }}
        >
          <span className="flex items-center gap-2">
            {item.icon && (
              <span className="w-[14px] h-[14px] flex items-center justify-center shrink-0" aria-hidden>
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
          <div id={childrenId} className="ml-5 mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-2">
            {item.children.map((c) => (
              <NavRow key={c.href} item={c} activePath={activePath} Link={Link} />
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
        'mx-1.5 flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all',
        active
          ? 'bg-white/[0.1] text-white'
          : 'text-sidebar-fg hover:bg-white/[0.05] hover:text-slate-200',
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
}> = ({ title, description, breadcrumbs, actions, meta, className }) => (
  <div className={cn('px-7 pt-5 pb-4', className)}>
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-fg-muted font-semibold mb-1.5">
        {breadcrumbs.map((b, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {b.href ? (
              <a href={b.href} className="hover:text-fg">
                {b.label}
              </a>
            ) : (
              <span>{b.label}</span>
            )}
            {i < breadcrumbs.length - 1 && <span className="text-fg-muted/60">/</span>}
          </span>
        ))}
      </nav>
    )}
    <div className="flex items-start justify-between gap-5 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-fg-muted max-w-3xl">{description}</p>}
        {meta && <div className="mt-2.5 flex items-center gap-2 flex-wrap">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </div>
);

export const PageBody: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('px-7 pb-8', className)}>{children}</div>;
