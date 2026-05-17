'use client';
import type { ReactNode } from 'react';
import { ArrowRightIcon, CheckIcon } from '@eazepay/ui/web';

/**
 * Service-page layout used by Marketing Consult + Sales Recruitment.
 * Same shape as IntegrationPage but with an "Choose your agency"
 * section at the bottom — vertical groups (Medical / Coaches) each
 * containing 1–2 agency cards with their own description + Book a
 * Call CTA.
 */

export interface AgencyStat {
  label: string;
  value: string;
}

export interface AgencyFeature {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface AgencyCard {
  name: string;
  blurb: string;
  bullets: string[];
  cta: string;
}

export interface AgencyVertical {
  label: string;
  agencies: AgencyCard[];
}

export interface AgencyPickerPageProps {
  category?: string; // "SERVICE"
  name: string; // "Marketing Consult"
  icon: ReactNode;
  heading: string;
  body: string;
  stats: AgencyStat[];
  features: AgencyFeature[];
  whatsIncluded: string[];
  verticals: AgencyVertical[];
  pickHeading?: string;
}

export function AgencyPickerPage(props: AgencyPickerPageProps) {
  const {
    category = 'SERVICE',
    name,
    icon,
    heading,
    body,
    stats,
    features,
    whatsIncluded,
    verticals,
    pickHeading = 'Choose Your Agency',
  } = props;
  return (
    <div className="px-8 py-6 max-w-4xl">
      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
        {category}
      </p>
      <h1 className="mt-1 text-fg">{name}</h1>

      <div className="mt-4 rounded-xl border border-border bg-bg-elevated">
        <div className="p-6">
          <div className="h-12 w-12 rounded-xl bg-[#0d1530] text-white flex items-center justify-center">
            {icon}
          </div>
          <h2 className="mt-5 text-[18px] font-semibold tracking-tight text-fg">{heading}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-secondary max-w-2xl">{body}</p>
        </div>

        <div
          className={
            'grid border-t border-border ' +
            (stats.length === 2
              ? 'grid-cols-2'
              : stats.length === 3
                ? 'grid-cols-3'
                : 'grid-cols-4')
          }
        >
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

        <div className="grid grid-cols-3 border-t border-border">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={'p-5 ' + (i < features.length - 1 ? 'border-r border-border' : '')}
            >
              <span className="text-fg-muted block mb-2">{f.icon}</span>
              <p className="text-[14px] font-semibold text-fg">{f.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">{f.description}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-6">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-3">
            What&apos;s Included
          </p>
          <ul className="space-y-2">
            {whatsIncluded.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-fg-secondary">
                <span className="h-4 w-4 rounded-full border border-green-300 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckIcon size={10} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Choose your agency */}
      <div className="mt-8">
        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-3">
          {pickHeading}
        </p>
        <div className="space-y-6">
          {verticals.map((v) => (
            <div key={v.label}>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-3">
                {v.label}
              </p>
              <div className={'grid gap-4 ' + (v.agencies.length > 1 ? 'md:grid-cols-2' : '')}>
                {v.agencies.map((a) => (
                  <div key={a.name} className="rounded-xl border border-border bg-bg-elevated p-5">
                    <h3 className="text-[15px] font-semibold text-fg">{a.name}</h3>
                    <p className="mt-1 text-[12px] text-fg-secondary leading-relaxed">{a.blurb}</p>
                    <ul className="mt-3 space-y-1.5">
                      {a.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-start gap-2 text-[12px] text-fg-secondary"
                        >
                          <span className="h-3 w-3 rounded-full border border-green-300 bg-green-50 shrink-0 mt-0.5" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] hover:bg-[#1a2a52]"
                    >
                      {a.cta}
                      <ArrowRightIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
