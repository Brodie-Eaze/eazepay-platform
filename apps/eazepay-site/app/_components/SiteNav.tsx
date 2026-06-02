'use client';

import { useState } from 'react';
import { NAV_LINKS } from '../data';
import { LogoMark, ArrowRight } from './icons';
import { Container, ctaPrimary } from './primitives';

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-elevated/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-6">
        <a
          href="/"
          className="flex items-center gap-2.5 no-underline"
          onClick={() => setOpen(false)}
        >
          <span className="ez-logo-tile grid h-9 w-9 place-items-center rounded-[11px] text-white">
            <LogoMark size={19} />
          </span>
          <span className="text-[18px] font-bold tracking-[-0.02em] text-fg">
            Eaze<span className="text-brand-sky">Pay</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13.5px] font-medium text-fg-secondary no-underline transition-colors hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="https://app.eazepay.com/sign-in?from=%2F"
            className="hidden text-[13.5px] font-semibold text-fg-secondary no-underline transition-colors hover:text-fg sm:inline"
          >
            Sign in
          </a>
          <a href="/book" className={`${ctaPrimary} max-sm:hidden`}>
            Book a call
            <ArrowRight size={15} />
          </a>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="ez-nav-burger grid h-10 w-10 place-items-center rounded-xl border border-border text-fg md:hidden"
          >
            <span className={`ez-burger ${open ? 'ez-burger--open' : ''}`} aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </Container>

      {/* Mobile dropdown panel */}
      <div className={`ez-nav-sheet md:hidden ${open ? 'ez-nav-sheet--open' : ''}`}>
        <Container className="flex flex-col gap-1 py-3">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-[15px] font-medium text-fg-secondary no-underline transition-colors hover:bg-bg hover:text-fg"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/book"
            onClick={() => setOpen(false)}
            className={`${ctaPrimary} mt-2 w-full justify-center`}
          >
            Book a call
            <ArrowRight size={15} />
          </a>
        </Container>
      </div>
    </header>
  );
}
