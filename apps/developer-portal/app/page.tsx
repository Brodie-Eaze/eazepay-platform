import Link from 'next/link';
import {
  Logo,
  Button,
  StatusPill,
  Card,
  CardBody,
  CodeBlock,
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  PackageIcon,
  KeyIcon,
  WebhookIcon,
  BoltIcon,
  SparkIcon,
  DocIcon,
  RouteIcon,
} from '@eazepay/ui/web';

export default function DevPortal() {
  return (
    <div className="min-h-screen bg-bg">
      {/* nav */}
      <header className="border-b border-border bg-bg-elevated/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Logo size={28} />
            <span className="text-[12px] uppercase tracking-wider text-fg-muted font-semibold">Developers</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-[14px]">
            <Link href="#quickstart" className="text-fg-secondary hover:text-fg">Quickstart</Link>
            <Link href="#api" className="text-fg-secondary hover:text-fg">API</Link>
            <Link href="#webhooks" className="text-fg-secondary hover:text-fg">Webhooks</Link>
            <Link href="#money" className="text-fg-secondary hover:text-fg">Money</Link>
            <Link href="#sdks" className="text-fg-secondary hover:text-fg">SDKs</Link>
            <Link href="#lender" className="text-fg-secondary hover:text-fg">Lender adapter</Link>
            <Link href="http://localhost:3300/docs" className="text-fg-secondary hover:text-fg">Swagger</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">Sign in</Button>
            <Button size="sm" trailingIcon={<KeyIcon size={14} />}>Get sandbox keys</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-accent-gradient pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16 grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
          <div className="lg:col-span-3">
            <StatusPill tone="accent" icon={<SparkIcon size={12} />}>v1 stable · OpenAPI 3.1 · SOC 2 Type II</StatusPill>
            <h1 className="mt-5 text-[44px] md:text-[56px] font-bold leading-[1.05] tracking-tight">
              Embedded financing
              <br />
              <span className="text-accent">that ships in an afternoon.</span>
            </h1>
            <p className="mt-5 text-[17px] text-fg-secondary max-w-xl leading-relaxed">
              EazePay's API gives your merchants, your CRM, or your app one integration to issue real consumer
              loans — TILA-compliant, bank-of-record-backed, RTP-funded.
            </p>
            <div className="mt-7 flex gap-3 flex-wrap">
              <Button size="lg" trailingIcon={<ArrowRightIcon />}>Sign up · sandbox keys</Button>
              <Button size="lg" variant="secondary">Read the quickstart</Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-fg-muted">
              <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> 30-min integration</span>
              <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Versioned, RFC 7807 errors</span>
              <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Idempotency built in</span>
              <span className="flex items-center gap-1.5"><CheckIcon size={14} className="text-success" /> Full webhook replay</span>
            </div>
          </div>

          <div className="lg:col-span-2">
            <CodeBlock language="bash" filename="Create an application link · 30s integration">{`curl -X POST https://api.eazepay.com/v1/merchants/{me}/application-links \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sale_amount_cents": 1950000,
    "term_months": 60,
    "customer_email": "alex@example.com",
    "product_note": "11.6 kW solar · 13.5 kWh battery",
    "expires_in_minutes": 1440
  }'

# {
#   "id": "lnk_8KvRT2mQpN",
#   "url": "https://eazepay.com/apply/...",
#   "expires_at": "2026-05-05T18:48:00Z"
# }`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* Integration paths */}
      <section className="border-t border-border bg-bg-elevated">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-[28px] font-bold tracking-tight">Pick your integration path.</h2>
          <p className="mt-1 text-[14px] text-fg-muted max-w-2xl">
            From a 30-second hosted link all the way to a full server-to-server lender adapter — pick what fits your stack.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <BoltIcon />, label: 'Hosted apply link', time: '~10 min', desc: 'Send a signed URL. Customer applies on EazePay. Webhook tells you the outcome.' },
              { icon: <PackageIcon />, label: 'Embedded widget', time: '~30 min', desc: 'Drop our JS bundle into your checkout. Inline modal, your brand, our compliance.' },
              { icon: <RouteIcon />, label: 'Full API + webhooks', time: '~1–2 days', desc: 'Originate from your own UI. Server-to-server with HMAC + idempotency.' },
              { icon: <ShieldIcon />, label: 'Lender adapter', time: 'Onboarding', desc: 'You\'re a lender. Plug into our orchestration to receive routed applications.' },
            ].map((p) => (
              <Card key={p.label}>
                <CardBody>
                  <div className="size-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-3">{p.icon}</div>
                  <h3 className="text-[15px] font-semibold flex items-center gap-2">
                    {p.label} <StatusPill tone="neutral">{p.time}</StatusPill>
                  </h3>
                  <p className="mt-1 text-[12px] text-fg-muted leading-relaxed">{p.desc}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Quickstart */}
      <section id="quickstart" className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1">
            <h2 className="text-[28px] font-bold tracking-tight">Quickstart</h2>
            <p className="mt-2 text-[14px] text-fg-muted leading-relaxed">
              From zero to a working sandbox application in under 30 minutes. Test data is deterministic, so you
              can drive approve / decline / counter-offer scenarios from the same test applicant.
            </p>
            <div className="mt-6 space-y-3">
              {[
                'Sign up · grab sandbox keys',
                'Configure your webhook endpoint',
                'Create a test application link',
                'Send to a test applicant',
                'Receive funded.webhook → done',
              ].map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="size-6 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[11px] font-semibold">
                    {i + 1}
                  </div>
                  <span className="text-[13px]">{step}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <CodeBlock language="bash" filename="1 · Authenticate">{`export EAZEPAY_KEY="sk_test_…"
curl https://sandbox.eazepay.com/v1/me \\
  -H "Authorization: Bearer $EAZEPAY_KEY"`}</CodeBlock>
            <CodeBlock language="bash" filename="2 · Configure webhook">{`curl -X POST https://sandbox.eazepay.com/v1/merchants/{me}/webhooks \\
  -H "Authorization: Bearer $EAZEPAY_KEY" \\
  -d '{
    "url": "https://your-app.example.com/eazepay/webhooks",
    "events": ["application.*", "loan.*"]
  }'`}</CodeBlock>
            <CodeBlock language="bash" filename="3 · Create application link">{`curl -X POST https://sandbox.eazepay.com/v1/merchants/{me}/application-links \\
  -H "Authorization: Bearer $EAZEPAY_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "sale_amount_cents": 1950000,
    "term_months": 60,
    "customer_email": "applicant_test_prime_001@eazepay.test"
  }'`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* API + Webhooks */}
      <section id="api" className="border-t border-border bg-bg-elevated">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-[28px] font-bold tracking-tight">Core surface area</h2>
          <p className="mt-1 text-[14px] text-fg-muted max-w-3xl">
            REST, JSON, versioned in URL (<code>/v1</code>). Auth via bearer token; HMAC signatures on server-to-server. Idempotency required on every write.
          </p>
          <div className="mt-10 grid grid-cols-1 xl:grid-cols-3 gap-4">
            {[
              { ep: 'POST /v1/applications', desc: 'Create an application on behalf of a customer.' },
              { ep: 'GET /v1/applications/{id}/offers', desc: 'Fetch ranked offers from the orchestration engine.' },
              { ep: 'POST /v1/offers/{id}/accept', desc: 'Customer-side acceptance + e-sign envelope creation.' },
              { ep: 'POST /v1/merchants/{me}/application-links', desc: 'Generate a signed hosted-apply URL.' },
              { ep: 'GET /v1/loans/{id}', desc: 'Loan + repayment schedule + servicing status.' },
              { ep: 'POST /v1/payment-assistance', desc: 'Open a hardship / forbearance request (UDAAP-aligned).' },
              { ep: 'POST /v1/orchestration/evaluate', desc: 'Score against rules + lenders before submit.' },
              { ep: 'POST /v1/partner/applications/{id}/respond', desc: 'Lender-side response: approve / decline / counter.' },
              { ep: 'GET /v1/admin/audit-logs', desc: 'Append-only, hash-chained, time-windowed.' },
            ].map((e) => (
              <Card key={e.ep}>
                <CardBody>
                  <div className="font-mono text-[12px] text-accent mb-1">{e.ep}</div>
                  <p className="text-[13px] text-fg-secondary">{e.desc}</p>
                </CardBody>
              </Card>
            ))}
          </div>
          <div className="mt-8">
            <a href="http://localhost:3300/docs" className="text-accent text-[14px] flex items-center gap-1.5">
              Full OpenAPI 3.1 (Swagger) <ArrowRightIcon size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* Webhooks */}
      <section id="webhooks" className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight">Webhooks built like a bank's.</h2>
            <p className="mt-2 text-[14px] text-fg-muted leading-relaxed">
              HMAC-SHA256 signed with your endpoint secret, replay-protected with timestamp + nonce, and retried
              with exponential backoff for 24 hours before dead-letter. Every delivery is replayable from the
              dashboard.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 text-[13px]">
              {[
                ['X-EazePay-Signature', 'Hex-encoded HMAC-SHA256 of timestamp + "." + nonce + "." + body'],
                ['X-EazePay-Timestamp', 'Unix seconds — reject anything > 5 min skew'],
                ['X-EazePay-Nonce', 'Per-delivery uuid; dedupe on the receiver side'],
                ['X-EazePay-Event-Id', 'Stable event identifier (used for replay correlation)'],
                ['X-EazePay-Delivery-Id', 'Per-attempt id (different on retries)'],
              ].map(([k, v]) => (
                <div key={k} className="rounded border border-border bg-bg-elevated p-3">
                  <div className="font-mono text-[12px] text-accent">{k}</div>
                  <div className="text-[12px] text-fg-muted mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <CodeBlock language="typescript" filename="Verify a webhook (Node / Edge)">{`import crypto from 'crypto';

export function verifyEazePay(req: Request, raw: string, secret: string): boolean {
  const ts = req.headers.get('x-eazepay-timestamp');
  const sig = req.headers.get('x-eazepay-signature');
  const nonce = req.headers.get('x-eazepay-nonce');
  if (!ts || !sig || !nonce) return false;

  // 5-min skew window
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${ts}.\${nonce}.\${raw}\`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(sig), Buffer.from(expected),
  );
}`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* Money movement */}
      <section id="money" className="border-t border-border bg-bg-elevated">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
            <div>
              <StatusPill tone="accent">Cards + ACH + EZ Check</StatusPill>
              <h2 className="mt-3 text-[28px] font-bold tracking-tight">Money movement, one SDK.</h2>
              <p className="mt-2 text-[14px] text-fg-muted leading-relaxed max-w-2xl">
                EazePay wraps two processors — MiCamp for card acceptance and HighSale for EZ Check
                (electronic-check + Web-debit) — behind one API. Tokenize a payment method, call our
                rail-agnostic charge endpoint, and we pick the right rail under the hood with automatic
                fallback.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardBody>
                <div className="flex items-center gap-2 mb-2">
                  <StatusPill tone="success" dot>Live</StatusPill>
                  <span className="text-[15px] font-semibold">MiCamp · cards</span>
                </div>
                <p className="text-[13px] text-fg-secondary leading-relaxed">
                  Card-present, card-not-present, and stored-credential transactions. Network tokenization,
                  3-D Secure step-up, and dispute automation — all handled inside the EazePay SDK so you
                  never touch a PAN.
                </p>
                <ul className="mt-4 space-y-1.5 text-[12px] text-fg-muted">
                  <li className="flex items-center gap-1.5"><CheckIcon size={12} className="text-success" /> Visa · Mastercard · Discover · Amex</li>
                  <li className="flex items-center gap-1.5"><CheckIcon size={12} className="text-success" /> 3DS · risk-based step-up</li>
                  <li className="flex items-center gap-1.5"><CheckIcon size={12} className="text-success" /> Recurring + stored-credential</li>
                  <li className="flex items-center gap-1.5"><CheckIcon size={12} className="text-success" /> PCI SAQ-A path · we hold no card data</li>
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center gap-2 mb-2">
                  <StatusPill tone="success" dot>Live</StatusPill>
                  <span className="text-[15px] font-semibold">HighSale · EZ Check</span>
                </div>
                <p className="text-[13px] text-fg-secondary leading-relaxed">
                  Electronic check rail (RCC + Web-debit) for high-ticket sales where card economics hurt.
                  Bank account verification via Plaid Auth or micro-deposits; pre-debit notices and return
                  monitoring built in.
                </p>
                <ul className="mt-4 space-y-1.5 text-[12px] text-fg-muted">
                  <li className="flex items-center gap-1.5"><CheckIcon size={12} className="text-success" /> RCC + Web-debit · same-day ACH eligible</li>
                  <li className="flex items-center gap-1.5"><CheckIcon size={12} className="text-success" /> Plaid Auth · micro-deposit fallback</li>
                  <li className="flex items-center gap-1.5"><CheckIcon size={12} className="text-success" /> 10-day pre-debit notice enforced</li>
                  <li className="flex items-center gap-1.5"><CheckIcon size={12} className="text-success" /> Nacha return-rate monitor + alerts</li>
                </ul>
              </CardBody>
            </Card>
          </div>

          <div className="mt-6">
            <CodeBlock language="typescript" filename="One charge, two rails">{`import { EazePay } from '@eazepay/node';

const ep = new EazePay({ apiKey: process.env.EAZEPAY_KEY });

// 1. Tokenize whichever instrument the customer chose at checkout
const pm = await ep.paymentMethods.create({
  type: 'card',           // or 'ez_check' (HighSale) or 'bank_account'
  card: { token: 'tok_micamp_…' },
  customer: 'cus_8KvR2NQp',
});

// 2. Charge it — EazePay picks the rail and handles 3DS / pre-debit notice / return monitoring
const charge = await ep.charges.create({
  amount_cents: 1_950_00,
  currency: 'usd',
  payment_method: pm.id,
  description: 'TradePay · solar PV down payment',
  rail_preference: ['ez_check', 'card'],   // try HighSale first, fall back to MiCamp
  idempotency_key: '8KvR2NQp-down-payment',
});

// 3. Listen for the webhook
//    charge.succeeded · charge.failed · charge.dispute_opened
//    Same envelope as every other EazePay webhook (HMAC-SHA256, replay-protected).
`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* SDKs */}
      <section id="sdks" className="border-t border-border bg-bg-elevated">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-[28px] font-bold tracking-tight">SDKs</h2>
          <p className="mt-1 text-[14px] text-fg-muted">All generated from the same OpenAPI spec. Typed responses, idempotency baked in, retries on transient errors.</p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { lang: 'TypeScript', cmd: 'pnpm add @eazepay/node' },
              { lang: 'Python', cmd: 'pip install eazepay' },
              { lang: 'PHP', cmd: 'composer require eazepay/eazepay' },
              { lang: 'Ruby', cmd: 'gem install eazepay' },
            ].map((s) => (
              <Card key={s.lang}>
                <CardBody>
                  <div className="text-[15px] font-semibold">{s.lang}</div>
                  <code className="block font-mono text-[12px] mt-2 text-fg-muted bg-bg-muted/40 rounded px-2 py-1.5">
                    {s.cmd}
                  </code>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Lender adapter */}
      <section id="lender" className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <StatusPill tone="accent">For lender partners</StatusPill>
            <h2 className="mt-3 text-[28px] font-bold tracking-tight">Plug into the orchestration engine.</h2>
            <p className="mt-2 text-[14px] text-fg-muted leading-relaxed">
              If you're a chartered bank, state-licensed consumer lender, or specialist program, you can plug
              into EazePay as a routed lender. We send you eligible applications + a normalized snapshot;
              you respond with offer / decline / counter. We handle disclosures, audit, e-sign, complaints.
            </p>
            <ul className="mt-5 space-y-2 text-[13px]">
              {[
                'SOC 2 + bank-partner audit pack delivered before integration',
                'Sandbox parity 100% with production',
                'Replay any production decision in sandbox for postmortem',
                'Adverse Action reason codes mapped to Reg B taxonomy',
                'Fair-lending bias review delivered quarterly',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckIcon size={14} className="text-success mt-0.5 shrink-0" /> {b}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button trailingIcon={<ArrowRightIcon size={14} />}>Open lender adapter docs</Button>
            </div>
          </div>
          <CodeBlock language="json" filename="POST /v1/partner/applications (you receive)">{`{
  "application_id": "app_4nqLkR2vTjW",
  "policy_version": "orch_v_2026_05_a",
  "applicant": {
    "state": "TX",
    "fico_band": "740-779",
    "income_monthly_cents": 684000,
    "stability": { "residence_years": 4.2, "employer_years": 5.1 },
    "dti_pct": 28.4,
    "mla_covered": false,
    "scra_active": false
  },
  "request": {
    "amount_cents": 1850000,
    "term_months": 60,
    "category": "home_improvement"
  },
  "snapshot_hash": "sha256:f4e9…",
  "permissible_purpose": "604(a)(3)(A)"
}`}</CodeBlock>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-bg-elevated">
        <div className="max-w-7xl mx-auto px-6 py-10 flex items-start justify-between gap-4 flex-wrap">
          <Logo size={24} />
          <div className="flex gap-6 text-[12px] text-fg-muted flex-wrap">
            <Link href="#" className="hover:text-fg">Status page</Link>
            <Link href="#" className="hover:text-fg">Changelog</Link>
            <Link href="#" className="hover:text-fg">Security disclosure</Link>
            <Link href="#" className="hover:text-fg">Service status</Link>
            <Link href="#" className="hover:text-fg">Compliance</Link>
            <Link href="#" className="hover:text-fg">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
