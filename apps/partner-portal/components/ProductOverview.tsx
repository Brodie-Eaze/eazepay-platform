import type { ReactNode } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  StatusPill,
  DataRow,
  Banner,
  ArrowRightIcon,
  CheckIcon,
} from '@eazepay/ui/web';

export interface ProductOverviewSpec {
  group: 'Integrations' | 'Services';
  title: string;
  /** One-liner under the title */
  tagline: string;
  /** Hex for the brand chip color */
  accent: string;
  /** Status of this integration/service for the current tenant */
  state: 'connected' | 'available' | 'invite-only' | 'beta';
  /** Bullets of what this product / service does */
  capabilities: ReactNode[];
  /** Side panel: key facts the operator wants to glance at */
  facts: Array<{ label: ReactNode; value: ReactNode }>;
  /** Optional banner above the body */
  bannerIntent?: 'info' | 'success' | 'warning';
  bannerTitle?: ReactNode;
  bannerBody?: ReactNode;
  /** Primary CTA */
  primaryCta: string;
  /** Secondary CTA */
  secondaryCta?: string;
}

const stateToPill = (s: ProductOverviewSpec['state']) => {
  if (s === 'connected') return <StatusPill tone="success" dot>Connected</StatusPill>;
  if (s === 'beta') return <StatusPill tone="warning">Beta</StatusPill>;
  if (s === 'invite-only') return <StatusPill tone="info">Invite-only</StatusPill>;
  return <StatusPill tone="neutral">Available</StatusPill>;
};

export function ProductOverview({ spec }: { spec: ProductOverviewSpec }) {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: spec.group }, { label: spec.title }]}
        title={
          <span className="flex items-center gap-3">
            <span className="size-3 rounded-full" style={{ background: spec.accent }} />
            {spec.title}
          </span>
        }
        description={spec.tagline}
        meta={<>{stateToPill(spec.state)}</>}
        actions={
          <>
            {spec.secondaryCta && <Button variant="ghost">{spec.secondaryCta}</Button>}
            <Button trailingIcon={<ArrowRightIcon size={14} />}>{spec.primaryCta}</Button>
          </>
        }
      />
      <PageBody>
        {spec.bannerTitle && (
          <Banner intent={spec.bannerIntent ?? 'info'} title={spec.bannerTitle} className="mb-4">
            {spec.bannerBody}
          </Banner>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardBody>
              <h3 className="text-[17px] font-semibold mb-3">What you get</h3>
              <ul className="space-y-2.5 text-[14px]">
                {spec.capabilities.map((c, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckIcon size={16} className="text-success mt-0.5 shrink-0" />
                    <span className="text-fg-secondary leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h3 className="text-[15px] font-semibold mb-3">At a glance</h3>
              {spec.facts.map((f, i) => (
                <DataRow key={i} label={f.label} value={f.value} />
              ))}
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
