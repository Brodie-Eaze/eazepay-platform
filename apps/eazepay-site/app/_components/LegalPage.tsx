import type { ReactNode } from 'react';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { Container, Eyebrow } from './primitives';

/**
 * Shared shell for long-form legal pages (Privacy, Terms). Children are plain
 * semantic HTML (h2/h3/p/ul/li/strong) styled by the prose wrapper below.
 */
export function LegalPage({
  kicker,
  title,
  updated,
  intro,
  children,
}: {
  kicker: string;
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main className="bg-bg py-14 sm:py-20">
        <Container className="max-w-3xl">
          <Eyebrow>{kicker}</Eyebrow>
          <h1 className="mt-5 text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-fg sm:text-[42px]">
            {title}
          </h1>
          <p className="mt-3 text-[13px] font-medium text-fg-muted">Last updated: {updated}</p>
          <div className="mt-6 text-[15px] leading-relaxed text-fg-secondary">{intro}</div>

          <article
            className={[
              'mt-10 border-t border-border pt-8',
              '[&_h2]:mt-10 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-fg',
              '[&_h2:first-child]:mt-0',
              '[&_h3]:mt-6 [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:text-fg',
              '[&_p]:mt-3 [&_p]:text-[14.5px] [&_p]:leading-relaxed [&_p]:text-fg-secondary',
              '[&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-1',
              '[&_li]:flex [&_li]:gap-2.5 [&_li]:text-[14.5px] [&_li]:leading-relaxed [&_li]:text-fg-secondary',
              "[&_li]:before:mt-[9px] [&_li]:before:h-1.5 [&_li]:before:w-1.5 [&_li]:before:shrink-0 [&_li]:before:rounded-full [&_li]:before:bg-brand-sky [&_li]:before:content-['']",
              '[&_strong]:font-semibold [&_strong]:text-fg',
              '[&_a]:font-semibold [&_a]:text-brand-sky [&_a]:no-underline',
            ].join(' ')}
          >
            {children}
          </article>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
