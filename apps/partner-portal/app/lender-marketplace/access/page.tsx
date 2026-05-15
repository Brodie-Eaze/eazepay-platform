'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusPill,
  Input,
  Select,
  Banner,
  DataTable,
  Money,
  type Column,
  SearchIcon,
  ShieldIcon,
  ArrowRightIcon,
} from '@eazepay/ui/web';
import {
  marketplaces,
  marketplaceLenders,
  partnerAccessOverrides as seedOverrides,
  isLenderEnabledForPartner,
  tierLabel,
  type CreditTier,
  type PartnerAccessOverride,
} from '../../../lib/marketplace-data';
import { BRANDS } from '@eazepay/shared-types';
import { partners as partnerList } from '../../../lib/master-data';

type AccessStatus = { enabled: boolean; via: 'global' | 'override' | 'marketplace-paused' };

const TierPill = ({ tier }: { tier: CreditTier }) => {
  const tone =
    tier === 'prime_plus' || tier === 'prime'
      ? ('success' as const)
      : tier === 'near_prime'
        ? ('info' as const)
        : tier === 'sub_prime'
          ? ('warning' as const)
          : ('neutral' as const);
  return <StatusPill tone={tone}>{tierLabel[tier]}</StatusPill>;
};

export default function AccessMatrixPage() {
  const [selectedPartnerId, setSelectedPartnerId] = useState(partnerList[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('');
  const [overrides, setOverrides] = useState<PartnerAccessOverride[]>(seedOverrides);

  const partner = partnerList.find((p) => p.id === selectedPartnerId)!;

  const lenderRows = useMemo(() => {
    let list = marketplaceLenders;
    if (marketplaceFilter) list = list.filter((l) => l.marketplaceId === marketplaceFilter);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) =>
          l.displayName.toLowerCase().includes(q) ||
          l.legalName.toLowerCase().includes(q) ||
          l.externalLenderId.toLowerCase().includes(q),
      );
    }
    return list;
  }, [marketplaceFilter, query]);

  const accessFor = (lenderId: string): AccessStatus => {
    const lender = marketplaceLenders.find((l) => l.id === lenderId)!;
    const marketplace = marketplaces.find((m) => m.id === lender.marketplaceId)!;
    if (marketplace.status !== 'active') return { enabled: false, via: 'marketplace-paused' };
    const override = overrides.find(
      (o) => o.merchantId === selectedPartnerId && o.marketplaceLenderId === lenderId,
    );
    if (override) return { enabled: override.enabled, via: 'override' };
    return { enabled: lender.globallyEnabled, via: 'global' };
  };

  const setOverride = (lenderId: string, enabled: boolean | null) => {
    setOverrides((prev) => {
      const without = prev.filter(
        (o) => !(o.merchantId === selectedPartnerId && o.marketplaceLenderId === lenderId),
      );
      if (enabled === null) return without; // revert to global default
      return [
        ...without,
        {
          merchantId: selectedPartnerId,
          marketplaceLenderId: lenderId,
          enabled,
          reason: enabled ? 'Force-enabled by master admin' : 'Disabled by master admin',
          changedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const effectiveEnabledForPartner = lenderRows.filter((l) => accessFor(l.id).enabled).length;
  const explicitOverridesForPartner = overrides.filter((o) => o.merchantId === selectedPartnerId).length;

  const columns: Column<(typeof marketplaceLenders)[number]>[] = [
    {
      key: 'lender',
      header: 'Lender',
      cell: (l) => {
        const mkt = marketplaces.find((m) => m.id === l.marketplaceId)!;
        return (
          <div>
            <div className="font-medium">{l.displayName}</div>
            <div className="text-[12px] text-fg-muted">
              {l.legalName} · {mkt.displayName}
            </div>
          </div>
        );
      },
    },
    {
      key: 'tiers',
      header: 'Tiers',
      cell: (l) => (
        <div className="flex flex-wrap gap-1">
          {l.servesTiers.map((t) => (
            <TierPill key={t} tier={t} />
          ))}
        </div>
      ),
    },
    {
      key: 'brands',
      header: 'Brands',
      cell: (l) =>
        l.brands.length === 0 ? (
          <span className="text-[12px] text-fg-muted">All</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {l.brands.map((b) => (
              <span key={b} className="text-[11px] inline-flex items-center gap-1 rounded-full bg-bg-muted px-1.5 py-0.5">
                <span className="size-1.5 rounded-full" style={{ background: BRANDS[b].accentHex }} />
                {BRANDS[b].name}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: 'envelope',
      header: 'Envelope',
      align: 'right',
      cell: (l) => (
        <span className="text-[12px] tabular-nums text-fg-muted">
          <Money cents={l.minAmountCents} compact noFractions /> – <Money cents={l.maxAmountCents} compact noFractions />
        </span>
      ),
    },
    {
      key: 'access',
      header: 'Access',
      cell: (l) => {
        const status = accessFor(l.id);
        if (status.via === 'marketplace-paused') {
          return <StatusPill tone="warning">Marketplace paused</StatusPill>;
        }
        if (status.via === 'override') {
          return status.enabled ? (
            <StatusPill tone="accent" icon={<ShieldIcon size={11} />}>Override · enabled</StatusPill>
          ) : (
            <StatusPill tone="danger" icon={<ShieldIcon size={11} />}>Override · disabled</StatusPill>
          );
        }
        return status.enabled ? (
          <StatusPill tone="success" dot>Inherited · on</StatusPill>
        ) : (
          <StatusPill tone="neutral">Inherited · off</StatusPill>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (l) => {
        const status = accessFor(l.id);
        const isOverridden = status.via === 'override';
        const lender = marketplaceLenders.find((ml) => ml.id === l.id)!;
        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              size="sm"
              variant={status.enabled && status.via !== 'marketplace-paused' ? 'subtle' : 'ghost'}
              onClick={() => setOverride(l.id, true)}
              disabled={status.via === 'marketplace-paused'}
            >
              Force on
            </Button>
            <Button
              size="sm"
              variant={!status.enabled && status.via === 'override' ? 'danger' : 'ghost'}
              onClick={() => setOverride(l.id, false)}
              disabled={status.via === 'marketplace-paused'}
            >
              Deny
            </Button>
            {isOverridden && (
              <Button size="sm" variant="ghost" onClick={() => setOverride(l.id, null)}>
                Reset to {lender.globallyEnabled ? 'on' : 'off'}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Master' },
          { label: 'Lender Marketplace', href: '/lender-marketplace' },
          { label: 'Access Matrix' },
        ]}
        title="Per-partner access matrix"
        description="Override the global lender pool for one partner at a time. Force a lender on, deny it, or revert to the global default. Every change is written to the audit chain."
        actions={
          <Link href="/lender-marketplace">
            <Button variant="ghost" trailingIcon={<ArrowRightIcon size={14} />}>
              Back to marketplaces
            </Button>
          </Link>
        }
      />
      <PageBody>
        <Banner intent="info" className="mb-4" title="Inheritance rule">
          When no override exists for a partner, the partner inherits the lender's <strong>global</strong>{' '}
          state. An override row replaces inheritance — useful for compliance holds, partner-requested
          allowlists, or one-off concessions. Overrides survive marketplace pauses (the marketplace
          status is the highest fence).
        </Banner>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <Card className="xl:col-span-1 h-fit">
            <CardHeader title="Select partner" />
            <CardBody padded={false}>
              <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
                {partnerList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPartnerId(p.id)}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-bg-muted/40 transition-colors ${
                      p.id === selectedPartnerId ? 'bg-bg-muted/60' : ''
                    }`}
                  >
                    <div className="size-9 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[11px] shrink-0">
                      {p.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{p.legalName}</div>
                      <div className="text-[11px] text-fg-muted truncate">{p.product}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader
              title={
                <span className="flex items-center gap-3">
                  {partner.legalName}
                  <StatusPill tone="accent">{partner.product}</StatusPill>
                </span>
              }
              description={
                <span>
                  <strong>{effectiveEnabledForPartner}</strong> of {lenderRows.length} lenders effectively
                  enabled · <strong>{explicitOverridesForPartner}</strong> explicit override
                  {explicitOverridesForPartner === 1 ? '' : 's'} for this partner
                </span>
              }
              action={
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search lender…"
                    leadingIcon={<SearchIcon size={14} />}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <Select
                    label=""
                    value={marketplaceFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setMarketplaceFilter(e.target.value)
                    }
                    options={[
                      { value: '', label: 'All marketplaces' },
                      ...marketplaces.map((m) => ({ value: m.id, label: m.displayName })),
                    ]}
                  />
                </div>
              }
            />
            <CardBody padded={false}>
              <DataTable columns={columns} rows={lenderRows} rowKey={(l) => l.id} dense />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
