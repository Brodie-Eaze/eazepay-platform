'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  Button as _Button,
  SearchIcon,
  ArrowRightIcon,
  DocIcon,
  PhoneIcon,
  SendIcon,
  RobotIcon,
  SparkIcon,
  type ButtonVariant,
  type ButtonSize,
} from '@eazepay/ui/web';
import { pluralize } from '@eazepay/shared-utils/pluralize';
import { helpArticles, type HelpArticle } from '../../lib/master-data';

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;

const CATEGORIES = [
  'All',
  'Getting started',
  'Applications',
  'Payouts',
  'Lenders',
  'Integrations',
  'Account',
] as const;

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('All');
  const [ticketOpen, setTicketOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = useMemo<HelpArticle[]>(() => {
    return helpArticles.filter((a) => {
      if (cat !== 'All' && a.category !== cat) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.summary.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [search, cat]);

  const byCat = useMemo(() => {
    const map = new Map<HelpArticle['category'], HelpArticle[]>();
    for (const a of filtered) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    return map;
  }, [filtered]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Account' }, { label: 'Help & support' }]}
        title="Help & support"
        description="Documentation, contact channels, and a place to file a support ticket. Most questions are answered below within seconds."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => flash('Status page: status.eazepay.com')}
            >
              Status page
            </Button>
            <Button size="sm" variant="primary" onClick={() => setTicketOpen(true)}>
              <SendIcon size={12} /> Open ticket
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <ContactCard
            title="Live chat"
            value="9am–6pm AEST"
            hint="Avg response 2 min · Mon–Fri"
            icon={<SparkIcon size={16} />}
            onClick={() => flash('Live chat opening (mock)')}
          />
          <ContactCard
            title="Phone support"
            value="+61 2 8000 1111"
            hint="24/7 for critical outages only"
            icon={<PhoneIcon size={16} />}
            onClick={() => flash('Dial +61 2 8000 1111')}
          />
          <ContactCard
            title="Email"
            value="support@eazepay.com"
            hint="Avg response 4 hours"
            icon={<SendIcon size={16} />}
            onClick={() => flash('Drafting email to support@eazepay.com')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[260px] max-w-md">
            <SearchIcon size={14} className="text-fg-muted" />
            <input
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={
                  'h-9 px-3 rounded-md text-[12px] font-medium border ' +
                  (cat === c
                    ? 'bg-fg text-white border-fg'
                    : 'bg-bg-elevated text-fg-secondary border-border hover:bg-bg-muted')
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardBody>
              <div className="py-8 text-center text-[13px] text-fg-muted">
                No articles match the current filters.{' '}
                <button
                  onClick={() => {
                    setSearch('');
                    setCat('All');
                  }}
                  className="text-accent hover:underline"
                >
                  Reset filters
                </button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {[...byCat.entries()].map(([catKey, articles]) => (
              <Card key={catKey}>
                <CardHeader title={catKey} description={pluralize(articles.length, 'article')} />
                <CardBody className="p-0">
                  <ul className="divide-y divide-border">
                    {articles.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => flash(`Opening "${a.title}" (docs viewer)`)}
                          className="w-full grid grid-cols-12 items-center gap-3 px-5 py-3 text-left hover:bg-bg-muted/40"
                        >
                          <div className="col-span-10 min-w-0">
                            <p className="text-[13px] font-semibold text-fg truncate flex items-center gap-2">
                              <DocIcon size={12} className="text-fg-muted" />
                              {a.title}
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted bg-bg-muted px-2 py-0.5 rounded-full shrink-0">
                                {a.readTime}
                              </span>
                            </p>
                            <p className="text-[11px] text-fg-muted mt-0.5">{a.summary}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <ArrowRightIcon size={12} className="text-fg-muted inline" />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-4">
          <CardBody>
            <div className="flex items-start gap-4">
              <span className="size-12 rounded-xl bg-fg text-white flex items-center justify-center shrink-0">
                <RobotIcon size={22} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-fg">Ask EAZE AI</p>
                <p className="text-[12px] text-fg-muted mt-0.5">
                  An AI assistant trained on the EazePay docs, your account, and your recent
                  applications. Most questions resolved without a ticket.
                </p>
              </div>
              <Link
                href="/eaze-ai"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-fg text-white text-[12px] font-semibold hover:bg-fg/90"
              >
                Open assistant <ArrowRightIcon size={11} />
              </Link>
            </div>
          </CardBody>
        </Card>
      </PageBody>

      {ticketOpen && (
        <TicketModal
          onClose={() => setTicketOpen(false)}
          onSubmit={() => {
            setTicketOpen(false);
            flash('Ticket #SUP-4812 created');
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}

function ContactCard({
  title,
  value,
  hint,
  icon,
  onClick,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-border bg-bg-elevated px-4 py-3 hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">
          {title}
        </span>
        <span className="text-fg-muted">{icon}</span>
      </div>
      <p className="mt-1.5 text-[16px] font-semibold text-fg leading-none">{value}</p>
      <p className="text-[11px] text-fg-muted mt-1.5">{hint}</p>
    </button>
  );
}

function TicketModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-bg-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[15px] font-semibold text-fg">Open a support ticket</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">
            <span aria-hidden>×</span>
            <span className="sr-only">Close</span>
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (subject.trim()) onSubmit();
          }}
          className="p-5 space-y-3"
        >
          <label className="block text-[12px] font-medium text-fg-secondary">
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="One-line summary"
              required
              className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
            />
          </label>
          <label className="block text-[12px] font-medium text-fg-secondary">
            Details
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="What were you trying to do? What did you expect? What happened?"
              className="mt-1.5 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px] outline-none"
            />
          </label>
          <label className="block text-[12px] font-medium text-fg-secondary">
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
            >
              <option value="low">Low · response within 1 business day</option>
              <option value="normal">Normal · response within 4 business hours</option>
              <option value="high">High · response within 1 business hour</option>
              <option value="urgent">Urgent · 24/7 phone callback (production outage)</option>
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-md border border-border text-[12px] text-fg-secondary hover:bg-bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!subject.trim()}
              className="h-9 px-3 rounded-md bg-fg text-white text-[12px] font-semibold disabled:opacity-40"
            >
              Submit ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
