import { NAV_LINKS } from '../data';
import { LogoMark, ArrowRight } from './icons';
import { Container, ctaPrimary } from './primitives';

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-elevated/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-6">
        <a href="#top" className="flex items-center gap-2.5 no-underline">
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

        <div className="flex items-center gap-4">
          <a
            href="#"
            className="hidden text-[13.5px] font-semibold text-fg-secondary no-underline transition-colors hover:text-fg sm:inline"
          >
            Sign in
          </a>
          <a href="#cta" className={ctaPrimary}>
            Book a demo
            <ArrowRight size={15} />
          </a>
        </div>
      </Container>
    </header>
  );
}
