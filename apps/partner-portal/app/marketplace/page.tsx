'use client';
import { useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  ExternalIcon,
  LinkIcon,
} from '@eazepay/ui/web';

/**
 * Service Marketplace — direct port of the Lovable `/marketplace`
 * page. Browse + filter services from other businesses in the EAZE
 * Pay network, by category chip. List Your Service CTA in the
 * top-right.
 *
 * Each card: Business name + category chip · description · 3 bullet
 * points · Website + Email actions.
 */

type Category =
  | 'All'
  | 'Accounting & Tax'
  | 'Insurance'
  | 'Legal & Compliance'
  | 'Branding & Design'
  | 'Technology'
  | 'Consulting'
  | 'Marketing'
  | 'HR & Staffing'
  | 'Other';

const CATEGORIES: Category[] = [
  'All',
  'Accounting & Tax',
  'Insurance',
  'Legal & Compliance',
  'Branding & Design',
  'Technology',
  'Consulting',
  'Marketing',
  'HR & Staffing',
  'Other',
];

interface ServiceListing {
  name: string;
  category: Exclude<Category, 'All'>;
  description: string;
  highlights: string[];
  website: string;
  email: string;
}

const LISTINGS: ServiceListing[] = [
  {
    name: 'BrightPath Consulting',
    category: 'Consulting',
    description:
      'Business strategy and growth consulting for lending companies, ISOs, and fintech startups.',
    highlights: ['Growth strategy', 'Market analysis', 'Revenue optimization'],
    website: 'https://brightpathconsulting.com',
    email: 'info@brightpathconsulting.com',
  },
  {
    name: 'PixelForge Design',
    category: 'Branding & Design',
    description:
      'Premium branding, web design, and pitch decks for fintech and financial services companies.',
    highlights: ['Brand identity', 'Website design', 'Investor pitch decks'],
    website: 'https://pixelforge.co',
    email: 'team@pixelforge.co',
  },
  {
    name: 'SecureVault Compliance',
    category: 'Legal & Compliance',
    description:
      'End-to-end compliance and risk management solutions for payment processors and financial services.',
    highlights: ['PCI-DSS audits', 'AML compliance', 'Risk assessments'],
    website: 'https://securevault.io',
    email: 'hello@securevault.io',
  },
  {
    name: 'Apex Tax Solutions',
    category: 'Accounting & Tax',
    description:
      'Strategic tax planning and preparation for businesses in financial services and lending.',
    highlights: ['Tax strategy', 'Entity structuring', 'Quarterly planning'],
    website: 'https://apextax.example',
    email: 'hello@apextax.example',
  },
  {
    name: 'PeakCover Insurance',
    category: 'Insurance',
    description:
      'Tailored business insurance packages for lending companies, ISOs, and payment processors.',
    highlights: ['Business liability', 'Cyber insurance', 'Professional indemnity'],
    website: 'https://peakcover.example',
    email: 'hello@peakcover.example',
  },
  {
    name: 'EliteHire Sales',
    category: 'HR & Staffing',
    description:
      'Sales placement agency connecting businesses with proven closers and appointment setters.',
    highlights: ['Sales rep placement', 'Setter & closer teams', '90-day guarantee'],
    website: 'https://elitehire.example',
    email: 'hello@elitehire.example',
  },
  {
    name: 'GrowthPulse Marketing',
    category: 'Marketing',
    description:
      'Performance marketing for financial services — paid ads, funnels, and lead generation at scale.',
    highlights: ['Paid media management', 'Funnel optimization', 'Lead gen campaigns'],
    website: 'https://growthpulse.example',
    email: 'hello@growthpulse.example',
  },
  {
    name: 'Forge Studio',
    category: 'Branding & Design',
    description:
      'Premium brand identity and visual design for fintech, lending, and SaaS companies.',
    highlights: ['Visual identity systems', 'Pitch deck design', 'Website design'],
    website: 'https://forgestudio.example',
    email: 'hello@forgestudio.example',
  },
  {
    name: 'NeuralEdge AI',
    category: 'Consulting',
    description:
      'AI consulting and automation solutions — chatbots, workflow automation, and data intelligence.',
    highlights: ['AI chatbots', 'Process automation', 'Data analytics'],
    website: 'https://neuraledge.example',
    email: 'hello@neuraledge.example',
  },
  {
    name: 'ShieldGuard Insurance',
    category: 'Insurance',
    description:
      'Business insurance solutions including general liability, E&O, and workers compensation.',
    highlights: ['General liability', 'E&O coverage', 'Workers comp'],
    website: 'https://shieldguard.example',
    email: 'hello@shieldguard.example',
  },
  {
    name: 'TaxPro Advisors',
    category: 'Accounting & Tax',
    description:
      'Full-service accounting and tax preparation for small businesses and independent contractors.',
    highlights: ['Tax preparation', 'Bookkeeping', 'Quarterly filings'],
    website: 'https://taxpro.example',
    email: 'hello@taxpro.example',
  },
  {
    name: 'ComplianceFirst',
    category: 'Legal & Compliance',
    description:
      'Regulatory compliance consulting for lending, financing, and payment processing businesses.',
    highlights: ['Lending compliance', 'Payment regulations', 'Policy audits'],
    website: 'https://compliancefirst.example',
    email: 'hello@compliancefirst.example',
  },
  {
    name: 'BrandForge Creative',
    category: 'Branding & Design',
    description:
      'Logo design, brand identity, and marketing collateral for financial services companies.',
    highlights: ['Logo design', 'Brand identity', 'Print & digital assets'],
    website: 'https://brandforge.example',
    email: 'hello@brandforge.example',
  },
];

export default function ServiceMarketplacePage() {
  const [active, setActive] = useState<Category>('All');
  const filtered = active === 'All' ? LISTINGS : LISTINGS.filter((l) => l.category === active);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Service' }, { label: 'Marketplace' }]}
        title="Marketplace"
        description="Browse and discover services from other businesses in the EAZE Pay network."
        actions={<Button size="sm">+ List Your Service</Button>}
      />
      <PageBody>
        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {CATEGORIES.map((c) => {
            const isActive = c === active;
            return (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={
                  'h-8 px-3 rounded-full text-[12px] font-medium transition-colors ' +
                  (isActive
                    ? 'bg-[#0d1530] text-white'
                    : 'bg-bg-elevated border border-border text-fg-secondary hover:text-fg hover:border-border-strong')
                }
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Listings grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((l) => (
            <Card key={l.name}>
              <CardBody>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-[14px] font-semibold text-fg">{l.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted bg-bg-muted px-2 py-0.5 rounded-full shrink-0">
                    {l.category}
                  </span>
                </div>
                <p className="text-[12px] text-fg-secondary leading-relaxed mb-3">
                  {l.description}
                </p>
                <ul className="space-y-1 mb-4">
                  {l.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-[12px] text-fg-secondary">
                      <span className="h-3 w-3 rounded-full border border-border bg-bg-muted shrink-0 mt-0.5" />
                      {h}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3 pt-3 border-t border-border">
                  <a
                    href={l.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-fg-secondary hover:text-fg flex items-center gap-1.5"
                  >
                    <LinkIcon size={12} />
                    Website
                  </a>
                  <a
                    href={`mailto:${l.email}`}
                    className="text-[12px] text-fg-secondary hover:text-fg flex items-center gap-1.5"
                  >
                    <ExternalIcon size={12} />
                    Email
                  </a>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
