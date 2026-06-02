import { LogoMark } from './icons';
import { Container } from './primitives';

const FOOTER_COLS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'Platform',
    links: [
      { label: 'Orchestration', href: '#platform' },
      { label: 'Lead flow', href: '#flow' },
      { label: 'Agents', href: '#agents' },
      { label: 'Marketplace', href: '#marketplace' },
    ],
  },
  {
    title: 'Verticals',
    links: [
      { label: 'MedPay', href: '#industries' },
      { label: 'TradePay', href: '#industries' },
      { label: 'CoachPay', href: '#industries' },
      { label: 'Launch a vertical', href: '#cta' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'FAQ', href: '#faq' },
      { label: 'Book a demo', href: '#cta' },
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
    ],
  },
];

const BADGES = ['SOC 2 Type II', 'PCI-DSS Level 1', 'FCRA-aware', 'Soft pull only'];

export function SiteFooter() {
  return (
    <footer className="ez-dark border-t border-white/10">
      <Container className="py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="ez-logo-tile grid h-9 w-9 place-items-center rounded-[11px] text-white">
                <LogoMark size={19} />
              </span>
              <span className="text-[18px] font-bold tracking-[-0.02em] text-white">
                Eaze<span className="text-brand-sky-soft">Pay</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/55">
              The financial infrastructure behind the brand — prequalification, agents, a lender
              marketplace and payment processing on one platform. MedPay, TradePay, CoachPay and
              VetPay ride on top.
            </p>
            <p className="mt-4 max-w-xs text-[11.5px] leading-relaxed text-white/40">
              EazePay is a technology platform, not a bank or a lender of record. Consumer financing
              is originated by partner lenders; card processing is provided through a registered ISO
              relationship.
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[13px] text-white/65 no-underline transition-colors hover:text-white"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] font-medium text-white/45">
            {BADGES.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
          <p className="text-[12px] text-white/40">© 2026 EazePay. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
