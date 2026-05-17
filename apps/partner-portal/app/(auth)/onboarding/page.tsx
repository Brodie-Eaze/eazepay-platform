'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Logo,
  Button,
  Input,
  Select,
  Textarea,
  Card,
  CardBody,
  CardFooter,
  StatusPill,
  Stepper,
  Banner,
  DataRow,
  Money,
  CodeBlock,
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  PackageIcon,
  BankIcon,
  KeyIcon,
} from '@eazepay/ui/web';
import { BRAND_ORDER, BRANDS, type BrandCode } from '@eazepay/shared-types';

type Step = 'business' | 'financial' | 'products' | 'kyb' | 'agreement' | 'keys' | 'done';

const STEPS: Array<{ key: Step; label: string; description: string }> = [
  { key: 'business', label: 'Business profile', description: 'Legal entity + signers' },
  { key: 'financial', label: 'Financial profile', description: 'Capital + audit posture' },
  { key: 'products', label: 'Products', description: 'Brands you serve' },
  { key: 'kyb', label: 'KYB & sanctions', description: 'Diligence checks' },
  { key: 'agreement', label: 'Agreement', description: 'Master partner contract' },
  { key: 'keys', label: 'Issue keys', description: 'Sandbox + live' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('business');
  const [selectedBrands, setSelectedBrands] = useState<Record<BrandCode, boolean>>({
    tradepay: false,
    medpay: false,
    coachpay: false,
    direct: false,
  });
  const [provisioning, setProvisioning] = useState(false);

  const idx = STEPS.findIndex((s) => s.key === step);

  const next = () => {
    const nextStep = STEPS[idx + 1];
    if (idx < STEPS.length - 1 && nextStep) setStep(nextStep.key);
    else setStep('done');
  };
  const back = () => {
    const prevStep = STEPS[idx - 1];
    if (idx > 0 && prevStep) setStep(prevStep.key);
  };

  // Resolve the destination after Finish: a single-brand merchant lands
  // inside that brand's portal so they never see other verticals; a
  // multi-brand merchant lands in the master command centre.
  const activeBrands = (Object.keys(selectedBrands) as BrandCode[]).filter(
    (b) => selectedBrands[b] && b !== 'direct',
  );
  const isSingleBrand = activeBrands.length === 1;
  const destination = isSingleBrand ? `/v/${BRANDS[activeBrands[0]!].slug}` : '/';
  const demoPreset = isSingleBrand ? activeBrands[0]! : 'admin';

  const finish = async () => {
    setProvisioning(true);
    try {
      // Seed a demo session so middleware lets us through and the shell
      // boots into the right vertical (or master) without a separate
      // sign-in step. Real production flow would mint a real session
      // after KYB clears; the demo cookie is only used pre-launch.
      await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: demoPreset }),
        credentials: 'include',
      });
    } catch {
      /* network errors fall through — we still navigate */
    }
    router.push(destination);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-bg">
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-5xl mx-auto h-16 px-6 flex items-center justify-between">
          <Logo size={28} />
          <Link href="/sign-in" className="text-[12px] text-fg-muted hover:text-fg">
            Already a partner? Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <span className="text-[12px] uppercase tracking-wider text-fg-muted font-semibold">
          Partner onboarding
        </span>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
          Let's get your team plugged into EazePay.
        </h1>
        <p className="mt-2 text-[14px] text-fg-muted max-w-2xl">
          Typical onboarding takes 6 business days. You can save progress at any point and we'll
          email a resume link to the workspace owner.
        </p>

        <Stepper items={STEPS} activeIndex={idx} className="mt-8 mb-8" />

        {step === 'business' && (
          <Card>
            <CardBody>
              <h2 className="text-[20px] font-semibold mb-1">Business profile</h2>
              <p className="text-[13px] text-fg-muted mb-5">
                Legal entity details. We verify against state Secretary of State + IRS TIN matching.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Legal name" placeholder="Evergreen Prime Finance, LLC" required />
                <Input label="DBA" placeholder="Evergreen Prime" />
                <Input label="EIN" placeholder="••-••••••5" required />
                <Select
                  label="Formation state"
                  defaultValue="DE"
                  options={[
                    { value: 'DE', label: 'Delaware' },
                    { value: 'NY', label: 'New York' },
                    { value: 'CA', label: 'California' },
                    { value: 'TX', label: 'Texas' },
                    { value: 'NV', label: 'Nevada' },
                  ]}
                />
                <Input label="Year founded" placeholder="2019" required />
                <Input label="Website" placeholder="https://" required />
                <Input label="Primary contact name" required />
                <Input label="Primary contact title" placeholder="Head of Partnerships" required />
                <Input label="Work email" type="email" required />
                <Input label="Direct phone" type="tel" />
              </div>
              <div className="mt-4">
                <Textarea
                  label="Tell us about your firm"
                  placeholder="What you originate, your typical loan profile, and why you'd like to partner with EazePay."
                />
              </div>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" disabled>
                Back
              </Button>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={next}>
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'financial' && (
          <Card>
            <CardBody>
              <h2 className="text-[20px] font-semibold mb-1">Financial profile</h2>
              <p className="text-[13px] text-fg-muted mb-5">
                Helps us route appropriate volume, confirm capital availability, and shape your
                audit pack.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Lending model"
                  defaultValue="bank-partner"
                  options={[
                    { value: 'bank-partner', label: 'Bank-partner (true lender = chartered bank)' },
                    { value: 'state-licensed', label: 'State-licensed consumer lender (NMLS)' },
                    { value: 'hybrid', label: 'Hybrid · bank-partner + state-licensed fallback' },
                  ]}
                />
                <Input
                  label="Bank-of-record (if applicable)"
                  placeholder="Cross River Bank · NMLS 409249"
                />
                <Select
                  label="Capital structure"
                  defaultValue="balance-sheet"
                  options={[
                    { value: 'balance-sheet', label: 'Balance-sheet · whole-loan retention' },
                    { value: 'forward-flow', label: 'Forward-flow / warehouse facility' },
                    { value: 'marketplace', label: 'Marketplace · whole-loan sale' },
                    { value: 'securitization', label: 'Securitization · ABS-ready loan tape' },
                  ]}
                />
                <Input label="Current outstanding (USD)" placeholder="$ 120,000,000" />
                <Input label="Annual originations (USD)" placeholder="$ 240,000,000" />
                <Input label="Live states" placeholder="41" />
                <Select
                  label="SOC 2 status"
                  defaultValue="type-ii"
                  options={[
                    { value: 'none', label: 'Not yet' },
                    { value: 'type-i', label: 'SOC 2 Type I' },
                    { value: 'type-ii', label: 'SOC 2 Type II' },
                    { value: 'iso-27001', label: 'SOC 2 Type II + ISO 27001' },
                  ]}
                />
                <Select
                  label="Fair-lending posture"
                  defaultValue="quarterly"
                  options={[
                    { value: 'none', label: 'Not yet formalized' },
                    { value: 'annual', label: 'Annual review' },
                    { value: 'quarterly', label: 'Quarterly review with written memo' },
                    { value: 'monthly', label: 'Monthly bias monitoring + quarterly review' },
                  ]}
                />
              </div>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={back}>
                Back
              </Button>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={next}>
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'products' && (
          <Card>
            <CardBody>
              <h2 className="text-[20px] font-semibold mb-1">Which brands will you serve?</h2>
              <p className="text-[13px] text-fg-muted mb-5">
                Pick one or more. You can adjust eligibility, capacity, and APR windows per brand
                once you're inside. Each brand is its own routing surface — partners are paired with
                brands they're a fit for, not all four.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {BRAND_ORDER.map((code) => {
                  const b = BRANDS[code];
                  const on = selectedBrands[code];
                  return (
                    <button
                      key={code}
                      onClick={() =>
                        setSelectedBrands((prev) => ({ ...prev, [code]: !prev[code] }))
                      }
                      className={`text-left rounded-lg border-2 p-4 transition-colors ${
                        on
                          ? 'border-accent bg-accent-soft/40'
                          : 'border-border bg-bg-elevated hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-3 rounded-full"
                            style={{ background: b.accentHex }}
                          />
                          <span className="text-[15px] font-semibold">{b.name}</span>
                        </div>
                        <span
                          className={`size-5 rounded-full border-2 flex items-center justify-center ${
                            on ? 'bg-accent border-accent text-accent-fg' : 'border-border-strong'
                          }`}
                        >
                          {on && <CheckIcon size={12} />}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] text-fg-secondary leading-relaxed">
                        {b.tagline}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {b.verticals.slice(0, 4).map((v) => (
                          <span
                            key={v}
                            className="text-[11px] bg-bg-muted rounded-full px-2 py-0.5"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-fg-muted">
                        <span>
                          <Money cents={b.envelope.sizeMin} compact noFractions /> –{' '}
                          <Money cents={b.envelope.sizeMax} compact noFractions />
                        </span>
                        <span>·</span>
                        <span>
                          {b.envelope.termMin}–{b.envelope.termMax} mo
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Banner intent="info" className="mt-4">
                Selecting <strong>All products</strong> just speeds up review. Final brand
                activation requires a fit check by our partner-success team — some brands have
                minimum FICO floors or state-licensing requirements that won't match every firm.
              </Banner>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={back}>
                Back
              </Button>
              <Button
                trailingIcon={<ArrowRightIcon size={14} />}
                onClick={next}
                disabled={!Object.values(selectedBrands).some((v) => v)}
              >
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'kyb' && (
          <Card>
            <CardBody>
              <h2 className="text-[20px] font-semibold mb-1">KYB & sanctions</h2>
              <p className="text-[13px] text-fg-muted mb-5">
                We run CIP, OFAC, PEP, and FinCEN BOI checks on your entity, beneficial owners
                (≥25%), and any authorized signers. Most checks complete inside 60 seconds.
              </p>
              <div className="space-y-3">
                {[
                  ['IRS TIN match (EIN)', 'Verifies legal name + EIN with IRS records.'],
                  ['Secretary of State good-standing', 'Confirms your entity is in good standing.'],
                  ['OFAC + sanctions screen', 'Entity, beneficial owners, signers.'],
                  ['PEP screen', 'Politically-exposed-person check via ComplyAdvantage.'],
                  [
                    'FinCEN BOI (CTA)',
                    'Beneficial Ownership Information per the Corporate Transparency Act.',
                  ],
                  [
                    'Adverse media + enforcement history',
                    'CFPB, FTC, state AG actions in last 7 years.',
                  ],
                ].map(([title, desc]) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-md border border-border bg-bg-elevated p-3"
                  >
                    <span className="size-7 rounded-full bg-success-bg text-success flex items-center justify-center shrink-0">
                      <CheckIcon size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{title}</div>
                      <div className="text-[12px] text-fg-muted">{desc}</div>
                    </div>
                    <StatusPill tone="success" dot>
                      Ready to run
                    </StatusPill>
                  </div>
                ))}
              </div>
              <Banner intent="warning" className="mt-4">
                For each beneficial owner ≥ 25%, we'll request government ID + DOB + residential
                address. Files are encrypted at rest and stored only for the retention period
                required (5 years post account closure under BSA).
              </Banner>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={back}>
                Back
              </Button>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={next}>
                Run KYB checks
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'agreement' && (
          <Card>
            <CardBody>
              <h2 className="text-[20px] font-semibold mb-1">Master partner agreement</h2>
              <p className="text-[13px] text-fg-muted mb-5">
                Outlines the partnership terms — service levels, audit rights, data handling,
                fair-lending obligations, and incident response. Counter-signed by EazePay's CFO and
                your authorized signer.
              </p>
              <div className="rounded-lg border border-border bg-bg-muted/40 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldIcon size={16} />
                    <span className="font-semibold text-[14px]">
                      EazePay Master Partner Agreement
                    </span>
                  </div>
                  <StatusPill tone="info">v2026.05 · 24 pages</StatusPill>
                </div>
                <ul className="space-y-2 text-[13px]">
                  {[
                    'Service-level targets (p95 latency, error rate, uptime)',
                    'Data classification + GLBA Safeguards-aligned controls',
                    'Fair-lending obligations + quarterly disparate-impact review',
                    'Incident response · 4-hour mutual notification',
                    'Audit rights · annual on-site + ad hoc for cause',
                    'Termination · 90-day glide path with active-loan wind-down',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <CheckIcon size={14} className="text-success mt-0.5 shrink-0" /> {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-3">
                  <Button variant="secondary">Download draft</Button>
                  <Button variant="ghost">Send to legal</Button>
                </div>
              </div>
              <Banner intent="success" className="mt-4">
                When your signer applies their e-signature, EazePay's CFO is auto-notified for
                counter-signature. Median time to fully executed: 2 business days.
              </Banner>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={back}>
                Back
              </Button>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={next}>
                E-sign the agreement
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'keys' && (
          <Card>
            <CardBody>
              <h2 className="text-[20px] font-semibold mb-1">Issue your API keys</h2>
              <p className="text-[13px] text-fg-muted mb-5">
                One sandbox key for build-time, one live key for production. Both are HMAC-signed
                and scoped to your account. Live keys are only revealed once.
              </p>
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-bg-elevated p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold flex items-center gap-2">
                      <KeyIcon size={14} /> Sandbox key
                    </span>
                    <StatusPill tone="info">test</StatusPill>
                  </div>
                  <code className="block font-mono text-[12px] bg-bg-muted/60 rounded px-2 py-1.5">
                    ep_test_R8mQp_5fA9c2e1d4b7e9f1c3a2b4d5e6f7a8b9c0
                  </code>
                  <p className="mt-2 text-[12px] text-fg-muted">
                    Drives the same orchestration engine as production, against synthetic
                    applicants.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-elevated p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold flex items-center gap-2">
                      <KeyIcon size={14} /> Live key
                    </span>
                    <StatusPill tone="success">live</StatusPill>
                  </div>
                  <code className="block font-mono text-[12px] bg-bg-muted/60 rounded px-2 py-1.5">
                    ep_live_••••••••••••••••••••••••••••••••
                  </code>
                  <p className="mt-2 text-[12px] text-fg-muted">
                    Revealed once after fit-check approval. Store in a secrets manager (AWS / GCP /
                    HashiCorp).
                  </p>
                </div>
              </div>
              <Banner intent="info" className="mt-4">
                After clicking <strong>Finish</strong> you'll land on your live dashboard with
                sandbox already connected. A partner-success manager will reach out within one
                business day to walk through your first routed application.
              </Banner>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={back}>
                Back
              </Button>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={next}>
                Finish · open dashboard
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'done' && (
          <Card>
            <CardBody className="text-center py-14">
              <div className="inline-flex size-14 rounded-full bg-success-bg text-success items-center justify-center mb-4">
                <CheckIcon size={28} />
              </div>
              <h2 className="text-[24px] font-semibold">Welcome to EazePay.</h2>
              <p className="mt-2 text-[14px] text-fg-muted max-w-md mx-auto">
                Your workspace is provisioned. Your partner-success manager has been paged and will
                email you within one business day to coordinate the first routed application.
              </p>

              {isSingleBrand ? (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-[12px] text-fg-secondary">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: BRANDS[activeBrands[0]!].accentHex }}
                  />
                  Landing in your{' '}
                  <strong className="text-fg">{BRANDS[activeBrands[0]!].name}</strong> portal —
                  single-vertical scope.
                </div>
              ) : activeBrands.length > 1 ? (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-[12px] text-fg-secondary">
                  <span className="size-2 rounded-full bg-accent" />
                  Landing in the <strong className="text-fg">Master command centre</strong> —{' '}
                  {activeBrands.map((b) => BRANDS[b].name).join(' + ')} all visible.
                </div>
              ) : null}

              <div className="mt-7 flex items-center justify-center gap-3">
                <Button
                  trailingIcon={<ArrowRightIcon size={14} />}
                  onClick={finish}
                  disabled={provisioning}
                >
                  {provisioning
                    ? 'Opening…'
                    : isSingleBrand
                      ? `Open ${BRANDS[activeBrands[0]!].name} portal`
                      : 'Open your dashboard'}
                </Button>
                <Link href="/docs">
                  <Button variant="secondary">Read integration docs</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </main>
  );
}
