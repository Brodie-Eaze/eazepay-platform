'use client';
import { useEffect, useState } from 'react';
import {
  PageBody,
  Card,
  CardBody,
  Button,
  StatusPill,
  ArrowRightIcon,
  CopyIcon,
  CheckIcon,
  SendIcon,
  RouteIcon,
  BankIcon,
} from '@eazepay/ui/web';

/**
 * Submit Application page — direct port of Lovable's `/submit/<brand>`
 * page. Same structure for every product, only the eyebrow + title +
 * description change. Three cards:
 *   1. "Start a New Application" — 3-step preview (Application →
 *      Decision Engine → Lender Match) + [Start Application] CTA
 *   2. "Send to Client" — three rows: text / email / copy link
 *      Each send action ticks to a "Sent" pill on success so the
 *      partner sees the confirmation.
 *   3. "QR Code" — server-rendered QR pointing at the partner-unique
 *      apply URL. Drop it on a printed flyer or in-store iPad and the
 *      customer scans straight into the flow.
 */

export interface SubmitApplicationConfig {
  eyebrow: string; // "EAZE PAY" / "MED PAY" / "TRADE PAY"
  title: string;
  description: string;
  applyHref: string; // route the "Start Application" button opens
  linkUrl: string; // copyable apply URL
}

export function SubmitApplicationPage({ config }: { config: SubmitApplicationConfig }) {
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [smsSent, setSmsSent] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  // If the caller passed a relative path (e.g. `/apply/medpay?ref=p_42`)
  // we prepend the current deployment origin so clipboard / QR / Open
  // all produce a fully-qualified URL the partner can paste anywhere.
  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);
  const effectiveLinkUrl = config.linkUrl.startsWith('http')
    ? config.linkUrl
    : `${origin}${config.linkUrl}`;

  const copy = () => {
    navigator.clipboard.writeText(effectiveLinkUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Demo-only senders — the production path POSTs to the BFF which
  // hits Twilio (10DLC registered) for SMS + SES for email. The UI
  // pattern stays identical so the partner sees the same "Sent" pill.
  const sendSms = () => {
    if (!text.replace(/\D/g, '').match(/^\d{10}$/)) return;
    setSmsSent(text);
    setText('');
    setTimeout(() => setSmsSent(null), 4000);
  };
  const sendEmail = () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return;
    setEmailSent(email);
    setEmail('');
    setTimeout(() => setEmailSent(null), 4000);
  };

  // QR code rendered via a free CORS-friendly QR generator. No client
  // library needed; the URL is deterministic so it cache-keys cleanly.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(
    effectiveLinkUrl,
  )}`;

  return (
    <div className="px-8 py-6 max-w-4xl">
      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
        {config.eyebrow}
      </p>
      <h1 className="mt-1 text-fg">{config.title}</h1>
      <p className="mt-2 text-[14px] text-fg-secondary max-w-2xl">{config.description}</p>

      <PageBody>
        {/* Start a New Application */}
        <Card className="mb-4">
          <CardBody>
            <h2 className="text-[16px] font-semibold text-fg">Start a New Application</h2>
            <p className="text-[13px] text-fg-secondary mt-1 leading-relaxed max-w-2xl">
              Submit a customer to check financing eligibility. Our system will run them through the
              decision engine, match available offers, and route to the best lender.
            </p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Step icon={<SendIcon size={18} />} title="Application" sub="Customer intake" />
              <Step
                icon={<RouteIcon size={18} />}
                title="Decision Engine"
                sub="Instant evaluation"
              />
              <Step icon={<BankIcon size={18} />} title="Lender Match" sub="Best-fit routing" />
            </div>

            <a
              href={config.applyHref}
              className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] hover:bg-[#1a2a52]"
            >
              Start Application
              <ArrowRightIcon size={14} />
            </a>
          </CardBody>
        </Card>

        {/* Send to Client */}
        <Card>
          <CardBody>
            <h2 className="text-[16px] font-semibold text-fg">Send to Client</h2>
            <p className="text-[13px] text-fg-secondary mt-1">
              Share the application link with your client via text, email, or copy the link
              directly.
            </p>

            <div className="mt-5 space-y-5">
              <SendRow
                label="Send via text"
                placeholder="(555) 123-4567"
                inputType="tel"
                value={text}
                onChange={setText}
                onSend={sendSms}
                sentTo={smsSent}
                buttonLabel="Send SMS"
                valid={Boolean(text.replace(/\D/g, '').match(/^\d{10}$/))}
              />
              <SendRow
                label="Send via email"
                placeholder="customer@email.com"
                inputType="email"
                value={email}
                onChange={setEmail}
                onSend={sendEmail}
                sentTo={emailSent}
                buttonLabel="Send email"
                valid={Boolean(email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))}
              />

              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-2">
                  Copy application link
                </p>
                <div className="flex flex-col md:flex-row gap-2.5">
                  <input
                    readOnly
                    value={effectiveLinkUrl}
                    className="flex-1 h-11 rounded-lg border border-border bg-bg-elevated px-3.5 text-[13px] font-mono text-fg-muted outline-none shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]"
                  />
                  <Button size="md" variant={copied ? 'secondary' : 'primary'} onClick={copy}>
                    {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* QR — printable / in-store iPad scan */}
        <Card className="mt-4">
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
              <div className="rounded-xl border border-border bg-bg-elevated p-3 inline-flex items-center justify-center">
                <img src={qrSrc} width={180} height={180} alt="Scan to apply" className="block" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-fg">QR Code · Scan to Apply</h2>
                <p className="text-[13px] text-fg-secondary mt-1 max-w-md leading-relaxed">
                  Drop the QR on a printed flyer, in-store iPad, or invoice — the customer scans
                  straight into your partner-attributed apply flow. Every scan tracks back to your
                  partner ref so attribution stays clean across every channel.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <a
                    href={qrSrc}
                    download={`${config.eyebrow.toLowerCase().replace(/\s+/g, '-')}-qr.png`}
                    className="h-10 px-4 rounded-lg bg-[#0d1530] text-white font-semibold text-[13px] inline-flex items-center gap-2 hover:bg-[#1a2a52]"
                  >
                    Download QR
                  </a>
                  <a
                    href={effectiveLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-10 px-4 rounded-lg border border-border text-fg font-semibold text-[13px] inline-flex items-center gap-2 hover:bg-bg-muted"
                  >
                    Preview apply page
                    <ArrowRightIcon size={13} />
                  </a>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </div>
  );
}

function Step({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <div className="h-9 w-9 rounded-lg bg-[#0d1530] text-white flex items-center justify-center mb-3 shadow-[0_4px_10px_-3px_rgb(15_23_42_/_0.35)]">
        {icon}
      </div>
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      <p className="text-[12px] text-fg-muted mt-0.5">{sub}</p>
    </div>
  );
}

/**
 * Shared row for "Send via text" / "Send via email". The input and the
 * submit button are vertically stacked on small screens and laid out
 * side-by-side from `md:` up, with breathing room so the button looks
 * like a button (real shadow, proper width, not crushed against the
 * input edge).
 */
function SendRow({
  label,
  placeholder,
  inputType,
  value,
  onChange,
  onSend,
  sentTo,
  buttonLabel,
  valid,
}: {
  label: string;
  placeholder: string;
  inputType: 'tel' | 'email';
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sentTo: string | null;
  buttonLabel: string;
  valid: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-2 flex items-center gap-2">
        {label}
        {sentTo && (
          <StatusPill tone="success" dot>
            Sent to {sentTo}
          </StatusPill>
        )}
      </p>
      <div className="flex flex-col md:flex-row gap-2.5">
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-11 rounded-lg border border-border bg-bg-elevated px-3.5 text-[13px] outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] transition-shadow"
        />
        <Button size="md" onClick={onSend} disabled={!valid}>
          <SendIcon size={14} /> {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
