'use client';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  StatusPill,
  ArrowRightIcon,
  DocIcon,
} from '@eazepay/ui/web';
import type { LegalDoc } from '../lib/master-data';

/**
 * Renders a single legal document (terms, privacy, disclosures,
 * licenses, compliance) using the shared LegalDoc shape from
 * lib/master-data. Cross-links between docs at the bottom so anyone
 * arriving at one can navigate to the others.
 */
export function LegalDocPage({ doc, related }: { doc: LegalDoc; related: LegalDoc[] }) {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Legal' }, { label: doc.title }]}
        title={doc.title}
        description={doc.summary}
        meta={
          <>
            <StatusPill tone="neutral">v{doc.version}</StatusPill>
            <StatusPill tone="info">Effective {doc.effectiveDate}</StatusPill>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-3">
            {doc.sections.map((s) => (
              <Card key={s.heading}>
                <CardBody>
                  <h2 className="text-[15px] font-semibold text-fg">{s.heading}</h2>
                  <p className="text-[13px] text-fg-secondary leading-relaxed mt-2">{s.body}</p>
                </CardBody>
              </Card>
            ))}
            <Card>
              <CardBody>
                <h2 className="text-[15px] font-semibold text-fg">Questions?</h2>
                <p className="text-[13px] text-fg-secondary mt-2">
                  Reach the EazePay legal team at{' '}
                  <a href="mailto:legal@eazepay.com" className="text-accent hover:underline">
                    legal@eazepay.com
                  </a>
                  . For data-subject requests, contact{' '}
                  <a href="mailto:privacy@eazepay.com" className="text-accent hover:underline">
                    privacy@eazepay.com
                  </a>
                  .
                </p>
              </CardBody>
            </Card>
          </div>

          <aside className="space-y-3">
            <Card>
              <CardBody>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
                  Document
                </p>
                <p className="text-[13px] font-semibold text-fg">{doc.title}</p>
                <dl className="mt-3 space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Version</dt>
                    <dd className="text-fg font-medium">v{doc.version}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Effective date</dt>
                    <dd className="text-fg font-medium">{doc.effectiveDate}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Sections</dt>
                    <dd className="text-fg font-medium">{doc.sections.length}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
                  Related documents
                </p>
                <ul className="space-y-1.5">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/legal/${r.slug}`}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-bg-muted text-[13px]"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <DocIcon size={12} className="text-fg-muted shrink-0" />
                          <span className="text-fg truncate">{r.title}</span>
                        </span>
                        <ArrowRightIcon size={11} className="text-fg-muted shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
                  Need a signed copy?
                </p>
                <p className="text-[12px] text-fg-secondary">
                  Email{' '}
                  <a href="mailto:legal@eazepay.com" className="text-accent hover:underline">
                    legal@eazepay.com
                  </a>{' '}
                  to request a counter-signed PDF for your records.
                </p>
              </CardBody>
            </Card>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
