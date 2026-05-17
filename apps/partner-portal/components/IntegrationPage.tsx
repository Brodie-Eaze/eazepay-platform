'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRightIcon, CheckIcon } from '@eazepay/ui/web';

/**
 * Shared layout for every integration intro page. Mirrors the Lovable
 * "EAZE Partner Portal" reference exactly:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ INTEGRATION                                              │
 *   │ <Name>                                                   │
 *   │                                                          │
 *   │ ┌───────┐                                                │
 *   │ │ icon  │                                                │
 *   │ └───────┘                                                │
 *   │ <Heading>                                                │
 *   │ <Body paragraph>                                         │
 *   │                                                          │
 *   │ ┌─────────┬─────────┬─────────┐                          │
 *   │ │ Stat 1  │ Stat 2  │ Stat 3  │                          │
 *   │ └─────────┴─────────┴─────────┘                          │
 *   │                                                          │
 *   │ ┌────────┐ ┌────────┐                                    │
 *   │ │feature │ │feature │   (2×2 or 1×3)                     │
 *   │ └────────┘ └────────┘                                    │
 *   │                                                          │
 *   │ HOW IT WORKS / REQUIREMENTS                              │
 *   │   1 ...                                                  │
 *   │   2 ...                                                  │
 *   │                                                          │
 *   │ [ Connect X → ]                                          │
 *   └──────────────────────────────────────────────────────────┘
 *
 * One of `howItWorks` or `requirements` is rendered as the bottom
 * section; pass exactly one. Brand-product pages (CoachPay/TradePay/
 * MedPay) use requirements; EZ Check + DialerPay + Processing use
 * the numbered howItWorks list.
 */

export interface IntegrationStat {
  label: string; // "QUALIFICATION TIME"
  value: string; // "<10 sec"
}

export interface IntegrationFeature {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface IntegrationPageProps {
  /** Sidebar eyebrow + breadcrumb tag. Always "INTEGRATION" in Lovable. */
  category?: string;
  /** Sidebar/tab title, e.g. "EZ Check". */
  name: string;
  /** Dark-navy rounded square icon. Pass a single `<X size={22} />` icon. */
  icon: ReactNode;
  /** Card heading + body paragraph. */
  heading: string;
  body: string;
  /** 3 stats — Lovable uses 3 columns. */
  stats: IntegrationStat[];
  /** Feature cards. Pass 3 or 4 — layout adapts. */
  features: IntegrationFeature[];
  /** Numbered "HOW IT WORKS" list. Use this OR requirements. */
  howItWorks?: string[];
  /** Bulleted REQUIREMENTS list with checkmarks. Use this OR howItWorks. */
  requirements?: string[];
  /** Footer CTA. */
  cta: { label: string; href: string };
}

export function IntegrationPage(props: IntegrationPageProps) {
  const {
    category = 'INTEGRATION',
    name,
    icon,
    heading,
    body,
    stats,
    features,
    howItWorks,
    requirements,
    cta,
  } = props;

  return (
    <div className="px-8 py-6 max-w-3xl">
      {/* Eyebrow + name */}
      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
        {category}
      </p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-fg">{name}</h1>

      {/* Main card */}
      <div className="mt-4 rounded-xl border border-border bg-bg-elevated">
        {/* Icon + heading + body */}
        <div className="p-6">
          <div className="h-12 w-12 rounded-xl bg-[#0d1530] text-white flex items-center justify-center">
            {icon}
          </div>
          <h2 className="mt-5 text-[18px] font-semibold tracking-tight text-fg">{heading}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-secondary max-w-2xl">{body}</p>
        </div>

        {/* Stats — 3 columns, hairline dividers between */}
        <div className="grid grid-cols-3 border-t border-border">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={'p-5 ' + (i < stats.length - 1 ? 'border-r border-border' : '')}
            >
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">
                {s.label}
              </p>
              <p className="mt-1.5 text-[22px] font-bold tracking-tight text-fg">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Features grid */}
        <div
          className={
            'grid border-t border-border ' +
            (features.length === 4
              ? 'grid-cols-2'
              : features.length === 6
                ? 'grid-cols-3'
                : 'grid-cols-3')
          }
        >
          {features.map((f, i) => {
            const cols = features.length === 4 ? 2 : 3;
            const isLastInRow = (i + 1) % cols === 0;
            const isInLastRow = i >= features.length - cols;
            return (
              <div
                key={f.title}
                className={
                  'p-5 ' +
                  (isLastInRow ? '' : 'border-r border-border ') +
                  (isInLastRow ? '' : 'border-b border-border')
                }
              >
                <span className="text-fg-muted block mb-2">{f.icon}</span>
                <p className="text-[14px] font-semibold text-fg">{f.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">{f.description}</p>
              </div>
            );
          })}
        </div>

        {/* Bottom section: HOW IT WORKS or REQUIREMENTS */}
        {howItWorks && howItWorks.length > 0 && (
          <div className="border-t border-border p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-3">
              How it works
            </p>
            <ol className="space-y-2.5">
              {howItWorks.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-[13px] text-fg-secondary">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#0d1530] text-white text-[10px] font-semibold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {requirements && requirements.length > 0 && (
          <div className="border-t border-border p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-3">
              Requirements
            </p>
            <ul className="space-y-2">
              {requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-fg-secondary">
                  <span className="h-4 w-4 rounded-full border border-green-300 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon size={10} />
                  </span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-border p-6">
          <Link
            href={cta.href}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] hover:bg-[#1a2a52]"
          >
            {cta.label}
            <ArrowRightIcon size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
