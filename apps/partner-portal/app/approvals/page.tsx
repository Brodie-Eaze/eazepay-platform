'use client';
import { useState } from 'react';
import { PageHeader, PageBody, Card, CardBody, Button, ChevronDownIcon } from '@eazepay/ui/web';

/**
 * Merchant Approvals — direct port of Lovable's `/admin/approvals`.
 *
 * Inline expand reveals (per Lovable):
 *   • BUSINESS INFORMATION
 *   • BUSINESS DETAILS
 *   • FINANCIAL PROFILE
 *   • PORTAL PREVIEW — WHAT THEY'LL SEE
 *     - Niche / Industry radio chips (Coaching / Medical / Dental /
 *       Trades / Contractors / Trades + Medical (Hybrid) / General)
 *     - "Change before approving to override access"
 *     - Products chips · Integrations chips
 *   • [Approve / Send Log Ins]  [Decline] buttons
 */

const NICHES = [
  'Coaching',
  'Medical',
  'Dental',
  'Trades / Contractors',
  'Trades + Medical (Hybrid)',
  'General (All Access)',
] as const;

interface PendingMerchant {
  initials: string;
  name: string;
  product: 'MedPay' | 'TradePay' | 'CoachPay';
  email: string;
  phone?: string;
  appliedAt: string;
  /** Detail panel content for the inline expand. */
  business: { name: string; contact: string; website?: string; industry: string };
  details: { structure: string; ein: string; years: string; address: string; state: string };
  finance: {
    monthlyRevenue: string;
    avgTransaction: string;
    estMonthlyVolume: string;
    currentProcessor: string;
    acceptsCreditCards: string;
    previousMerchant: string;
    previousTerminated: string;
    chargebackRate: string;
  };
  /** Products + integrations the merchant will see post-approval. */
  defaultProducts: string[];
  defaultIntegrations: string[];
}

const SEED: PendingMerchant[] = [
  {
    initials: 'TE', name: 'Test Business', product: 'CoachPay',
    email: 'test@test.com', appliedAt: '14/05/2026',
    business: { name: 'Test Business', contact: 'Test User', industry: 'coaching' },
    details: { structure: '—', ein: '—', years: '—', address: '—', state: '—' },
    finance: { monthlyRevenue: '—', avgTransaction: '—', estMonthlyVolume: '—', currentProcessor: '—', acceptsCreditCards: '—', previousMerchant: '—', previousTerminated: '—', chargebackRate: '—' },
    defaultProducts: ['CoachPay'],
    defaultIntegrations: ['DialerPay', 'EZ Check', 'EAZE Processing', 'EAZE Affiliate'],
  },
  {
    initials: 'EL', name: 'Elite Business Coaching', product: 'CoachPay',
    email: 'pat@elitecoach.test', phone: '555-2003', appliedAt: '07/03/2026',
    business: { name: 'Elite Business Coaching', contact: 'Pat Sanchez', website: 'https://elitecoach.test', industry: 'coaching' },
    details: { structure: 'LLC', ein: '92-1112233', years: '3 – 5 years', address: 'Test address', state: 'CA' },
    finance: { monthlyRevenue: '$50,000 – $100,000', avgTransaction: '$2,500 – $5,000', estMonthlyVolume: '$60,000', currentProcessor: 'Stripe', acceptsCreditCards: 'Yes', previousMerchant: 'Yes', previousTerminated: 'No', chargebackRate: 'Under 1%' },
    defaultProducts: ['CoachPay'],
    defaultIntegrations: ['DialerPay', 'EZ Check', 'EAZE Affiliate'],
  },
  {
    initials: 'SM', name: 'Smile Dental Group', product: 'MedPay',
    email: 'amy@smiledental.test', phone: '555-2002', appliedAt: '07/03/2026',
    business: { name: 'Smile Dental Group', contact: 'Amy Walker', website: 'https://smiledental.test', industry: 'dental' },
    details: { structure: 'PLLC', ein: '95-2223344', years: '5 – 10 years', address: 'Test address', state: 'CA' },
    finance: { monthlyRevenue: '$100,000 – $250,000', avgTransaction: '$2,500 – $5,000', estMonthlyVolume: '$120,000', currentProcessor: 'Stripe', acceptsCreditCards: 'Yes', previousMerchant: 'Yes', previousTerminated: 'No', chargebackRate: 'Under 1%' },
    defaultProducts: ['MedPay'],
    defaultIntegrations: ['EZ Check', 'EAZE Processing'],
  },
  {
    initials: 'NE', name: 'NextGen Electrical', product: 'TradePay',
    email: 'sam@nextgen.test', phone: '555-2001', appliedAt: '05/03/2026',
    business: { name: 'NextGen Electrical', contact: 'Sam Park', website: 'https://nextgen.test', industry: 'trades' },
    details: { structure: 'LLC', ein: '94-3334455', years: '5 – 10 years', address: 'Test address', state: 'CA' },
    finance: { monthlyRevenue: '$250,000 – $500,000', avgTransaction: '$10,000 – $25,000', estMonthlyVolume: '$280,000', currentProcessor: 'Authorize.net', acceptsCreditCards: 'Yes', previousMerchant: 'Yes', previousTerminated: 'No', chargebackRate: 'Under 1%' },
    defaultProducts: ['TradePay'],
    defaultIntegrations: ['DialerPay', 'EZ Check', 'EAZE Processing'],
  },
  {
    initials: 'TI', name: 'Titan Electric & Solar', product: 'TradePay',
    email: 'marcus@titanelectric.test', phone: '555-2004', appliedAt: '04/03/2026',
    business: { name: 'Titan Electric & Solar', contact: 'Marcus Bell', website: 'https://titanelectric.test', industry: 'trades' },
    details: { structure: 'LLC', ein: '94-4445566', years: '1 – 3 years', address: 'Test address', state: 'AZ' },
    finance: { monthlyRevenue: '$100,000 – $250,000', avgTransaction: '$10,000 – $25,000', estMonthlyVolume: '$180,000', currentProcessor: 'Square', acceptsCreditCards: 'Yes', previousMerchant: 'No', previousTerminated: 'No', chargebackRate: 'Under 1%' },
    defaultProducts: ['TradePay'],
    defaultIntegrations: ['EZ Check', 'EAZE Processing'],
  },
  {
    initials: 'GL', name: 'Glow Aesthetics Med Spa', product: 'MedPay',
    email: 'nina@glowaesthetics.test', phone: '555-2005', appliedAt: '04/03/2026',
    business: { name: 'Glow Aesthetics Med Spa', contact: 'Nina Patel', website: 'https://glowaesthetics.test', industry: 'medical' },
    details: { structure: 'LLC', ein: '95-5556677', years: '3 – 5 years', address: 'Test address', state: 'TX' },
    finance: { monthlyRevenue: '$100,000 – $250,000', avgTransaction: '$2,500 – $5,000', estMonthlyVolume: '$140,000', currentProcessor: 'Stripe', acceptsCreditCards: 'Yes', previousMerchant: 'Yes', previousTerminated: 'No', chargebackRate: 'Under 1%' },
    defaultProducts: ['MedPay'],
    defaultIntegrations: ['DialerPay', 'EAZE Processing'],
  },
  {
    initials: 'MI', name: 'Mindset Mastery Academy', product: 'CoachPay',
    email: 'jordan@mindsetmastery.test', phone: '555-2006', appliedAt: '02/03/2026',
    business: { name: 'Mindset Mastery Academy', contact: 'Jordan Reeve', website: 'https://mindsetmastery.test', industry: 'coaching' },
    details: { structure: 'LLC', ein: '92-6667788', years: '3 – 5 years', address: 'Test address', state: 'NY' },
    finance: { monthlyRevenue: '$50,000 – $100,000', avgTransaction: '$1,000 – $2,500', estMonthlyVolume: '$70,000', currentProcessor: 'Stripe', acceptsCreditCards: 'Yes', previousMerchant: 'Yes', previousTerminated: 'No', chargebackRate: 'Under 1%' },
    defaultProducts: ['CoachPay'],
    defaultIntegrations: ['EZ Check', 'EAZE Affiliate'],
  },
  {
    initials: 'BR', name: 'BrightSmile Orthodontics', product: 'MedPay',
    email: 'kevin@brightsmile.test', phone: '555-2007', appliedAt: '01/03/2026',
    business: { name: 'BrightSmile Orthodontics', contact: 'Kevin Liu', website: 'https://brightsmile.test', industry: 'dental' },
    details: { structure: 'PLLC', ein: '95-7778899', years: '5 – 10 years', address: 'Test address', state: 'FL' },
    finance: { monthlyRevenue: '$100,000 – $250,000', avgTransaction: '$5,000 – $10,000', estMonthlyVolume: '$170,000', currentProcessor: 'Square', acceptsCreditCards: 'Yes', previousMerchant: 'Yes', previousTerminated: 'No', chargebackRate: 'Under 1%' },
    defaultProducts: ['MedPay'],
    defaultIntegrations: ['EZ Check', 'EAZE Processing'],
  },
];

export default function MerchantApprovalsPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [chosenNiche, setChosenNiche] = useState<Record<number, string>>({});
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Merchant Approvals"
        description="Review and approve businesses applying to the EAZE Portal"
      />
      <PageBody>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary bg-bg-elevated border border-border px-3 py-1 rounded-full">
            {SEED.length} Total
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary bg-bg-muted border border-border px-3 py-1 rounded-full">
            {SEED.length} Pending
          </span>
        </div>
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {SEED.map((m, i) => {
                const open = openIdx === i;
                const niche = chosenNiche[i] ?? capitalize(m.business.industry);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setOpenIdx(open ? null : i)}
                      className="w-full grid grid-cols-12 items-center gap-4 px-5 py-4 text-left hover:bg-bg-muted/40"
                    >
                      <div className="col-span-7 flex items-center gap-3 min-w-0">
                        <span className="size-10 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[12px] shrink-0">
                          {m.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-fg truncate flex items-center gap-2">
                            {m.name}
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-bg-muted text-fg-secondary border border-border shrink-0">
                              Pending
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-bg-muted text-fg-secondary shrink-0">
                              {m.product}
                            </span>
                          </p>
                          <p className="text-[12px] text-fg-muted truncate mt-0.5">
                            {m.email}
                            {m.phone ? ` · ${m.phone}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-4 text-right text-[12px] text-fg-muted">{m.appliedAt}</div>
                      <ChevronDownIcon
                        size={14}
                        className={
                          'col-span-1 justify-self-end text-fg-muted transition-transform ' +
                          (open ? 'rotate-180' : '')
                        }
                      />
                    </button>
                    {open && (
                      <div className="px-5 pb-5 pt-4 bg-bg-muted/30 border-t border-border">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Block title="Business Information">
                            <Row k="Business Name" v={m.business.name} />
                            <Row k="Contact Name" v={m.business.contact} />
                            <Row k="Email" v={m.email} />
                            <Row k="Phone" v={m.phone ?? ''} />
                            <Row k="Website" v={m.business.website ?? ''} />
                            <Row k="Industry" v={m.business.industry} cap />
                          </Block>
                          <Block title="Business Details">
                            <Row k="Structure" v={m.details.structure} />
                            <Row k="EIN / Tax ID" v={m.details.ein} />
                            <Row k="Years in Business" v={m.details.years} />
                            <Row k="Address" v={m.details.address} />
                            <Row k="State of Incorporation" v={m.details.state} />
                          </Block>
                          <Block title="Financial Profile">
                            <Row k="Monthly Revenue" v={m.finance.monthlyRevenue} />
                            <Row k="Avg Transaction" v={m.finance.avgTransaction} />
                            <Row k="Est. Monthly Volume" v={m.finance.estMonthlyVolume} />
                            <Row k="Current Processor" v={m.finance.currentProcessor} />
                            <Row k="Accepts Credit Cards" v={m.finance.acceptsCreditCards} />
                            <Row k="Previous Merchant Account" v={m.finance.previousMerchant} />
                            <Row k="Previous Account Terminated" v={m.finance.previousTerminated} />
                            <Row k="Monthly Chargeback Rate" v={m.finance.chargebackRate} />
                          </Block>
                        </div>

                        <div className="mt-6 rounded-xl border border-border bg-bg-elevated p-5">
                          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-3">
                            Portal Preview — What They&apos;ll See
                          </p>
                          <p className="text-[11px] font-semibold text-fg-secondary mb-2">Niche / Industry</p>
                          <div className="flex flex-wrap gap-2">
                            {NICHES.map((n) => {
                              const active = niche === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setChosenNiche((s) => ({ ...s, [i]: n }))}
                                  className={
                                    'h-8 px-3 rounded-full text-[12px] font-medium transition-colors border ' +
                                    (active
                                      ? 'bg-[#0d1530] text-white border-[#0d1530]'
                                      : 'bg-bg-elevated text-fg-secondary border-border hover:border-border-strong')
                                  }
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-fg-muted mt-2">
                            Change before approving to override access
                          </p>

                          <p className="text-[11px] font-semibold text-fg-secondary mt-4 mb-2">Products</p>
                          <div className="flex flex-wrap gap-2">
                            {m.defaultProducts.map((p) => (
                              <span key={p} className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-bg-muted text-fg-secondary">
                                {p}
                              </span>
                            ))}
                          </div>
                          <p className="text-[11px] font-semibold text-fg-secondary mt-4 mb-2">Integrations</p>
                          <div className="flex flex-wrap gap-2">
                            {m.defaultIntegrations.map((it) => (
                              <span key={it} className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-bg-muted text-fg-secondary">
                                {it}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                          <Button size="sm" variant="ghost">
                            Decline
                          </Button>
                          <Button size="sm">Approve / Send Log Ins</Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
        {title}
      </p>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function Row({ k, v, cap }: { k: string; v: string; cap?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-fg-muted">{k}</dt>
      <dd className={'text-[13px] text-fg ' + (cap ? 'capitalize' : '')}>{v || '—'}</dd>
    </div>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}
