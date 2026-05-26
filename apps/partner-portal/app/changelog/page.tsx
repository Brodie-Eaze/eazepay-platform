import { PageHeader, PageBody, Card, CardBody } from '@eazepay/ui/web';
import { PublicPageShell } from '../../components/PublicPageShell';
import { loadChangelog } from '../../lib/changelog';

/**
 * Public changelog — `/changelog`. No auth.
 *
 * Server component. Reads `content/changelog.md` at request time and
 * renders a Linear-style vertical timeline. Each entry is linkable via
 * `#YYYY-MM-DD` so a teammate can drop a deep-link in Slack.
 */

export const dynamic = 'force-static';

function formatHeading(date: string): string {
  // Render as the local longform date — keeps the H2 visually rich
  // while the URL anchor stays the stable ISO slug.
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function ChangelogPage() {
  const entries = loadChangelog();
  return (
    <PublicPageShell>
      <PageHeader
        title="Changelog"
        description="Platform releases, week over week. The list is curated — only ships that move the lender / partner integration forward make it in."
      />
      <PageBody>
        {entries.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-[13px] text-fg-muted">
                No releases recorded yet. Check back after the next ship.
              </p>
            </CardBody>
          </Card>
        ) : (
          <ol className="space-y-6">
            {entries.map((entry) => (
              <li key={entry.slug} id={entry.slug} className="scroll-mt-20">
                <Card>
                  <div className="border-b border-border px-5 py-4 flex items-baseline justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
                        {formatHeading(entry.date)}
                      </p>
                      <h2 className="text-[16px] font-semibold text-fg mt-1">{entry.title}</h2>
                    </div>
                    <a
                      href={`#${entry.slug}`}
                      className="text-[11px] font-mono text-fg-muted hover:text-fg transition-colors"
                      aria-label={`Permalink to ${entry.title}`}
                    >
                      #{entry.slug}
                    </a>
                  </div>
                  <CardBody>
                    <ul className="space-y-2 text-[13px] text-fg-secondary leading-relaxed">
                      {entry.items.map((item, idx) => (
                        <li key={idx} className="flex gap-2.5">
                          <span
                            aria-hidden
                            className="mt-2 size-1.5 shrink-0 rounded-full bg-fg-muted"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </PageBody>
    </PublicPageShell>
  );
}
