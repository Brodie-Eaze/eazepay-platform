'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  SearchIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  ExternalIcon,
} from '@eazepay/ui/web';
import { partners as MASTER_PARTNERS } from '../../lib/master-data';

/**
 * Match a partners-page row back to a master roster partner by email
 * domain or first significant word of the legal name. Falls back to the
 * first master partner so the "Open control page" CTA never 404s.
 */
function matchMasterId(name: string, email: string): string {
  const lowerName = name.toLowerCase();
  const lowerEmail = email.toLowerCase();
  for (const mp of MASTER_PARTNERS) {
    const firstWord = mp.legalName.split(' ')[0]!.toLowerCase();
    if (lowerName.includes(firstWord) || lowerEmail.includes(firstWord)) return mp.id;
    const domain = mp.email.split('@')[1]?.split('.')[0]?.toLowerCase();
    if (domain && lowerEmail.includes(domain)) return mp.id;
  }
  return MASTER_PARTNERS[0]?.id ?? 'p_atlas';
}

/**
 * Partner Directory — direct port of Lovable's `/admin/partners` page,
 * including the inline-expand drill that opens a 4-section detail:
 *   • BUSINESS INFORMATION
 *   • BUSINESS DETAILS
 *   • FINANCIAL PROFILE
 *   • ACTIVE SERVICES (chips)
 */

type Niche = 'coaching' | 'medical' | 'trades' | 'dental';
interface PartnerDetail {
  initials: string;
  name: string;
  product: 'MedPay' | 'TradePay' | 'CoachPay' | 'Multi-brand';
  email: string;
  phone: string;
  approvedAt: string;
  niche: Niche;
  business: { businessName: string; contactName: string; website: string };
  details: {
    structure: string;
    ein: string;
    yearsInBusiness: string;
    address: string;
    stateOfIncorporation: string;
  };
  finance: {
    monthlyRevenue: string;
    avgTransaction: string;
    estMonthlyVolume: string;
    currentProcessor: string;
    acceptsCreditCards: string;
    previousMerchantAccount: string;
    previousTerminated: string;
    chargebackRate: string;
  };
  activeServices: string[];
}

const SEED: PartnerDetail[] = [
  {
    initials: 'PR',
    name: 'Premier Coaching Group',
    product: 'CoachPay',
    email: 'sarah@premiercoaching.com',
    phone: '(305) 555-0101',
    approvedAt: '08/03/2026',
    niche: 'coaching',
    business: {
      businessName: 'Premier Coaching Group',
      contactName: 'Sarah Johnson',
      website: 'https://premiercoaching.com',
    },
    details: {
      structure: 'LLC',
      ein: '82-1234567',
      yearsInBusiness: '3 – 5 years',
      address: '1200 Brickell Ave, Suite 400, Miami, FL, 33131',
      stateOfIncorporation: 'FL',
    },
    finance: {
      monthlyRevenue: '$50,000 – $100,000',
      avgTransaction: '$2,500 – $5,000',
      estMonthlyVolume: '$75,000',
      currentProcessor: 'Stripe',
      acceptsCreditCards: 'Yes',
      previousMerchantAccount: 'Yes',
      previousTerminated: 'No',
      chargebackRate: 'Under 1%',
    },
    activeServices: [
      'CoachPay',
      'EAZE Med Pay',
      'EAZE Trade Pay',
      'DialerPay',
      'EZ Check',
      'EAZE Processing',
      'EAZE Affiliate',
    ],
  },
  {
    initials: 'ME',
    name: 'MedFirst Solutions',
    product: 'MedPay',
    email: 'james@medfirst.com',
    phone: '(212) 555-0202',
    approvedAt: '08/03/2026',
    niche: 'medical',
    business: {
      businessName: 'MedFirst Solutions',
      contactName: 'James Park',
      website: 'https://medfirst.com',
    },
    details: {
      structure: 'Corporation',
      ein: '13-4567890',
      yearsInBusiness: '5 – 10 years',
      address: '350 Madison Ave, New York, NY, 10017',
      stateOfIncorporation: 'NY',
    },
    finance: {
      monthlyRevenue: '$100,000 – $250,000',
      avgTransaction: '$5,000 – $10,000',
      estMonthlyVolume: '$150,000',
      currentProcessor: 'Square',
      acceptsCreditCards: 'Yes',
      previousMerchantAccount: 'Yes',
      previousTerminated: 'No',
      chargebackRate: 'Under 1%',
    },
    activeServices: ['MedPay', 'EAZE Processing', 'EZ Check'],
  },
  {
    initials: 'TR',
    name: 'TradeForce Pro',
    product: 'TradePay',
    email: 'mike@tradeforce.com',
    phone: '(415) 555-0303',
    approvedAt: '08/03/2026',
    niche: 'trades',
    business: {
      businessName: 'TradeForce Pro',
      contactName: 'Mike Henderson',
      website: 'https://tradeforcepro.com',
    },
    details: {
      structure: 'LLC',
      ein: '94-7890123',
      yearsInBusiness: '5 – 10 years',
      address: '500 Howard St, San Francisco, CA, 94105',
      stateOfIncorporation: 'CA',
    },
    finance: {
      monthlyRevenue: '$250,000 – $500,000',
      avgTransaction: '$10,000 – $25,000',
      estMonthlyVolume: '$350,000',
      currentProcessor: 'Authorize.net',
      acceptsCreditCards: 'Yes',
      previousMerchantAccount: 'Yes',
      previousTerminated: 'No',
      chargebackRate: 'Under 1%',
    },
    activeServices: ['TradePay', 'EAZE Processing'],
  },
  {
    initials: 'DE',
    name: 'Dental Care Partners',
    product: 'MedPay',
    email: 'amy@dentalcarepartners.com',
    phone: '(310) 555-0404',
    approvedAt: '08/03/2026',
    niche: 'dental',
    business: {
      businessName: 'Dental Care Partners',
      contactName: 'Amy Walker',
      website: 'https://dentalcarepartners.com',
    },
    details: {
      structure: 'LLC',
      ein: '95-2345678',
      yearsInBusiness: '3 – 5 years',
      address: '9100 Wilshire Blvd, Beverly Hills, CA, 90212',
      stateOfIncorporation: 'CA',
    },
    finance: {
      monthlyRevenue: '$50,000 – $100,000',
      avgTransaction: '$2,500 – $5,000',
      estMonthlyVolume: '$80,000',
      currentProcessor: 'Stripe',
      acceptsCreditCards: 'Yes',
      previousMerchantAccount: 'Yes',
      previousTerminated: 'No',
      chargebackRate: 'Under 1%',
    },
    activeServices: ['MedPay', 'EZ Check', 'EAZE Processing'],
  },
  {
    initials: 'EL',
    name: 'Elite Life Coaching',
    product: 'CoachPay',
    email: 'dana@elitelife.co',
    phone: '(702) 555-0505',
    approvedAt: '08/03/2026',
    niche: 'coaching',
    business: {
      businessName: 'Elite Life Coaching',
      contactName: 'Dana Reeves',
      website: 'https://elitelife.co',
    },
    details: {
      structure: 'LLC',
      ein: '88-3456789',
      yearsInBusiness: '1 – 3 years',
      address: '3960 Howard Hughes Pkwy, Las Vegas, NV, 89169',
      stateOfIncorporation: 'NV',
    },
    finance: {
      monthlyRevenue: '$25,000 – $50,000',
      avgTransaction: '$1,000 – $2,500',
      estMonthlyVolume: '$40,000',
      currentProcessor: 'Stripe',
      acceptsCreditCards: 'Yes',
      previousMerchantAccount: 'No',
      previousTerminated: 'No',
      chargebackRate: 'Under 1%',
    },
    activeServices: ['CoachPay', 'EAZE Affiliate'],
  },
  {
    initials: 'PE',
    name: 'Peak Performance Coaching',
    product: 'CoachPay',
    email: 'coach@eaze.test',
    phone: '555-1003',
    approvedAt: '22/12/2025',
    niche: 'coaching',
    business: {
      businessName: 'Peak Performance Coaching',
      contactName: 'Sam Tester',
      website: 'https://peakperformance.test',
    },
    details: {
      structure: 'LLC',
      ein: '00-0000000',
      yearsInBusiness: '1 – 3 years',
      address: 'Test Address',
      stateOfIncorporation: 'CA',
    },
    finance: {
      monthlyRevenue: '—',
      avgTransaction: '—',
      estMonthlyVolume: '—',
      currentProcessor: '—',
      acceptsCreditCards: '—',
      previousMerchantAccount: '—',
      previousTerminated: '—',
      chargebackRate: '—',
    },
    activeServices: ['CoachPay'],
  },
  {
    initials: 'ME',
    name: 'MedCare Clinic',
    product: 'MedPay',
    email: 'medical@eaze.test',
    phone: '555-1002',
    approvedAt: '20/12/2025',
    niche: 'medical',
    business: {
      businessName: 'MedCare Clinic',
      contactName: 'Test User',
      website: 'https://medcare.test',
    },
    details: {
      structure: 'LLC',
      ein: '00-0000000',
      yearsInBusiness: '3 – 5 years',
      address: 'Test Address',
      stateOfIncorporation: 'CA',
    },
    finance: {
      monthlyRevenue: '—',
      avgTransaction: '—',
      estMonthlyVolume: '—',
      currentProcessor: '—',
      acceptsCreditCards: '—',
      previousMerchantAccount: '—',
      previousTerminated: '—',
      chargebackRate: '—',
    },
    activeServices: ['MedPay'],
  },
  {
    initials: 'TR',
    name: 'TradesPro Services',
    product: 'TradePay',
    email: 'trades@eaze.test',
    phone: '555-1001',
    approvedAt: '15/12/2025',
    niche: 'trades',
    business: {
      businessName: 'TradesPro Services',
      contactName: 'Test User',
      website: 'https://tradespro.test',
    },
    details: {
      structure: 'LLC',
      ein: '00-0000000',
      yearsInBusiness: '3 – 5 years',
      address: 'Test Address',
      stateOfIncorporation: 'CA',
    },
    finance: {
      monthlyRevenue: '—',
      avgTransaction: '—',
      estMonthlyVolume: '—',
      currentProcessor: '—',
      acceptsCreditCards: '—',
      previousMerchantAccount: '—',
      previousTerminated: '—',
      chargebackRate: '—',
    },
    activeServices: ['TradePay'],
  },
  {
    initials: 'DE',
    name: 'Demo Account',
    product: 'Multi-brand',
    email: 'demo@eaze.test',
    phone: '555-1004',
    approvedAt: '10/12/2025',
    niche: 'trades',
    business: {
      businessName: 'Demo Account',
      contactName: 'Test User',
      website: 'https://demo.test',
    },
    details: {
      structure: 'LLC',
      ein: '00-0000000',
      yearsInBusiness: '5 – 10 years',
      address: 'Test Address',
      stateOfIncorporation: 'CA',
    },
    finance: {
      monthlyRevenue: '—',
      avgTransaction: '—',
      estMonthlyVolume: '—',
      currentProcessor: '—',
      acceptsCreditCards: '—',
      previousMerchantAccount: '—',
      previousTerminated: '—',
      chargebackRate: '—',
    },
    activeServices: ['TradePay', 'MedPay'],
  },
];

export default function PartnerDirectoryPage() {
  const [search, setSearch] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      SEED.filter((p) =>
        search
          ? p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.email.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [search],
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Partner Directory"
        description="Approved partners with full onboarding details"
      />
      <PageBody>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold text-fg-secondary bg-bg-elevated border border-border rounded-full px-3 py-1 inline-flex items-center gap-1.5">
            <SvgUsers /> {SEED.length} Partners
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 max-w-md mb-3">
          <SearchIcon size={14} className="text-fg-muted" />
          <input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
          />
        </div>

        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((p, i) => {
                const open = openIdx === i;
                return (
                  <li key={p.email + i}>
                    <button
                      type="button"
                      onClick={() => setOpenIdx(open ? null : i)}
                      className="w-full grid grid-cols-12 items-center gap-4 px-5 py-4 text-left hover:bg-bg-muted/40"
                    >
                      <div className="col-span-6 flex items-center gap-3 min-w-0">
                        <span className="size-10 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[12px] shrink-0">
                          {p.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-fg truncate flex items-center gap-2">
                            {p.name}
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-bg-inverse text-white shrink-0">
                              Approved
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-bg-muted text-fg-secondary shrink-0">
                              {p.product}
                            </span>
                          </p>
                          <p className="text-[12px] text-fg-muted truncate mt-0.5">
                            {p.email} · {p.phone}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-5 text-right text-[12px] text-fg-muted">
                        Approved {p.approvedAt}
                      </div>
                      <ChevronDownIcon
                        size={14}
                        className={
                          'col-span-1 justify-self-end text-fg-muted transition-transform ' +
                          (open ? 'rotate-180' : '')
                        }
                      />
                    </button>
                    {open && <PartnerDetailPanel p={p} />}
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

function PartnerDetailPanel({ p }: { p: PartnerDetail }) {
  return (
    <div className="px-5 pb-5 pt-4 grid grid-cols-1 md:grid-cols-3 gap-6 bg-bg-muted/30 border-t border-border">
      <Section title="Business Information">
        <Row k="Business Name" v={p.business.businessName} />
        <Row k="Contact Name" v={p.business.contactName} />
        <Row k="Email" v={p.email} />
        <Row k="Phone" v={p.phone} />
        <Row k="Website" v={p.business.website} />
        <Row k="Industry" v={p.niche} cap />
      </Section>
      <Section title="Business Details">
        <Row k="Structure" v={p.details.structure} />
        <Row k="EIN / Tax ID" v={p.details.ein} />
        <Row k="Years in Business" v={p.details.yearsInBusiness} />
        <Row k="Address" v={p.details.address} />
        <Row k="State of Incorporation" v={p.details.stateOfIncorporation} />
      </Section>
      <Section title="Financial Profile">
        <Row k="Monthly Revenue" v={p.finance.monthlyRevenue} />
        <Row k="Avg Transaction" v={p.finance.avgTransaction} />
        <Row k="Est. Monthly Volume" v={p.finance.estMonthlyVolume} />
        <Row k="Current Processor" v={p.finance.currentProcessor} />
        <Row k="Accepts Credit Cards" v={p.finance.acceptsCreditCards} />
        <Row k="Previous Merchant Account" v={p.finance.previousMerchantAccount} />
        <Row k="Previous Account Terminated" v={p.finance.previousTerminated} />
        <Row k="Monthly Chargeback Rate" v={p.finance.chargebackRate} />
      </Section>
      <div className="md:col-span-3 pt-2">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
          Active Services
        </p>
        <div className="flex flex-wrap gap-2">
          {p.activeServices.map((s) => (
            <span
              key={s}
              className="text-[12px] font-medium px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-fg-secondary"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="md:col-span-3 pt-2 flex flex-wrap gap-2 border-t border-border mt-3">
        <Link
          href={`/control-panel/${matchMasterId(p.name, p.email)}`}
          className="h-9 px-3 rounded-md bg-fg text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-fg/90"
        >
          Open control page <ArrowRightIcon size={11} />
        </Link>
        <Link
          href="/applications"
          className="h-9 px-3 rounded-md border border-border bg-bg-elevated text-[12px] font-medium text-fg-secondary hover:bg-bg-muted inline-flex items-center gap-1.5"
        >
          View applications <ExternalIcon size={11} />
        </Link>
        <Link
          href="/payouts"
          className="h-9 px-3 rounded-md border border-border bg-bg-elevated text-[12px] font-medium text-fg-secondary hover:bg-bg-muted inline-flex items-center gap-1.5"
        >
          View payouts <ExternalIcon size={11} />
        </Link>
        <a
          href={`mailto:${p.email}`}
          className="h-9 px-3 rounded-md border border-border bg-bg-elevated text-[12px] font-medium text-fg-secondary hover:bg-bg-muted inline-flex items-center gap-1.5"
        >
          Email partner
        </a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

function SvgUsers() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
