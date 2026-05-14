'use client';

import { useState } from 'react';
import {
  Logo,
  Button,
  Input,
  Card,
  CardBody,
  CardFooter,
  StatusPill,
  Stepper,
  DisclosurePanel,
  Banner,
  Money,
  Apr,
  DataRow,
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  BankIcon,
  SparkIcon,
} from '@eazepay/ui/web';

type Step =
  | 'profile'
  | 'address'
  | 'income'
  | 'bank'
  | 'soft-pull'
  | 'loading'
  | 'offers'
  | 'offer-detail'
  | 'esign'
  | 'funded';

const stepperItems = [
  { key: 'profile', label: 'About you', description: 'Name & contact' },
  { key: 'income', label: 'Verify income', description: 'Plaid or manual' },
  { key: 'soft-pull', label: 'Soft credit check', description: 'No score impact' },
  { key: 'offers', label: 'Compare offers', description: 'Side-by-side' },
  { key: 'esign', label: 'Sign & fund', description: 'Same-day RTP' },
];

const offers = [
  {
    id: 'offer_buzzpay',
    lender: 'BuzzPay',
    lenderOfRecord: 'Cross River Bank',
    badge: 'Lowest cost overall',
    aprBps: 849,
    termMonths: 60,
    monthlyCents: 384_55,
    totalCents: 2_307_300,
    financedCents: 1_950_000,
    feesCents: 0,
    isRecommended: true,
  },
  {
    id: 'offer_evergreen',
    lender: 'Evergreen Prime',
    lenderOfRecord: 'Cross River Bank',
    badge: 'Most popular',
    aprBps: 1099,
    termMonths: 60,
    monthlyCents: 423_42,
    totalCents: 2_540_520,
    financedCents: 1_950_000,
    feesCents: 0,
    isRecommended: false,
  },
  {
    id: 'offer_solstice',
    lender: 'Solstice',
    lenderOfRecord: 'WebBank',
    badge: 'Lowest monthly',
    aprBps: 1399,
    termMonths: 84,
    monthlyCents: 345_27,
    totalCents: 2_900_268,
    financedCents: 1_950_000,
    feesCents: 25_000,
    isRecommended: false,
  },
];

export default function ApplyPage({ params }: { params: { slug: string; token: string } }) {
  const merchantName = params.slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase());
  const [step, setStep] = useState<Step>('profile');
  const [selectedOfferId, setSelectedOfferId] = useState(offers[0].id);
  const [acceptedDisclosure, setAcceptedDisclosure] = useState(false);

  const stepperIndex = (() => {
    if (['profile', 'address'].includes(step)) return 0;
    if (['income', 'bank'].includes(step)) return 1;
    if (['soft-pull', 'loading'].includes(step)) return 2;
    if (['offers', 'offer-detail'].includes(step)) return 3;
    if (['esign', 'funded'].includes(step)) return 4;
    return 0;
  })();

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size={28} />
          <div className="flex items-center gap-3 text-[12px] text-fg-muted">
            <ShieldIcon size={14} /> Secure session · SOC 2 Type II
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <StatusPill tone="accent">Application from {merchantName}</StatusPill>
          <StatusPill tone="neutral">Sale $19,500 · 14.2kW Solar PV + Battery</StatusPill>
        </div>

        <Stepper items={stepperItems} activeIndex={stepperIndex} className="mb-8" />

        {step === 'profile' && (
          <Card>
            <CardBody>
              <h1 className="text-[24px] font-semibold mb-1">Tell us about you</h1>
              <p className="text-[14px] text-fg-muted mb-5">
                The same info every lender will need — collected once, encrypted at rest, and never sold.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="First name" defaultValue="Marcus" required />
                <Input label="Last name" defaultValue="Tahir" required />
                <Input label="Email" type="email" defaultValue="marcus.t@gmail.com" required />
                <Input label="Mobile" type="tel" defaultValue="(206) 555-0142" required />
                <Input label="Date of birth" type="date" defaultValue="1987-04-12" required />
                <Input label="Last 4 of SSN" placeholder="••••" maxLength={4} hint="Full SSN requested only at offer accept." required />
              </div>
            </CardBody>
            <CardFooter>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={() => setStep('address')}>
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'address' && (
          <Card>
            <CardBody>
              <h1 className="text-[24px] font-semibold mb-1">Your address</h1>
              <p className="text-[14px] text-fg-muted mb-5">
                Required for state APR rules + bank-partner export. We verify against USPS + identity bureau.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Input label="Street address" defaultValue="2418 Magnolia Pl" required />
                <div className="grid grid-cols-3 gap-3">
                  <Input label="City" defaultValue="Bellevue" required />
                  <Input label="State" defaultValue="WA" required />
                  <Input label="ZIP" defaultValue="98005" required />
                </div>
                <Input label="Time at address" defaultValue="3 years, 4 months" />
              </div>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={() => setStep('profile')}>Back</Button>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={() => setStep('income')}>
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'income' && (
          <Card>
            <CardBody>
              <h1 className="text-[24px] font-semibold mb-1">Your income</h1>
              <p className="text-[14px] text-fg-muted mb-5">
                Tell us roughly — we'll verify automatically via your bank or payroll on the next step.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Employer" defaultValue="Boeing" required />
                <Input label="Job title" defaultValue="Senior Manufacturing Engineer" required />
                <Input label="Annual income" leadingIcon={<span className="text-fg-muted">$</span>} defaultValue="142,000" required />
                <Input label="Years at employer" defaultValue="5.1" required />
                <Input label="Monthly housing payment" leadingIcon={<span className="text-fg-muted">$</span>} defaultValue="2,150" />
                <Input label="Other monthly debts" leadingIcon={<span className="text-fg-muted">$</span>} defaultValue="540" />
              </div>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={() => setStep('address')}>Back</Button>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={() => setStep('bank')}>
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'bank' && (
          <Card>
            <CardBody>
              <h1 className="text-[24px] font-semibold mb-1">Connect your bank</h1>
              <p className="text-[14px] text-fg-muted mb-5">
                Connect via Plaid in seconds. We verify income + assets in one click — no statements, no
                uploads. Read-only access; you can revoke any time.
              </p>
              <div className="rounded-lg border border-border bg-bg-muted/40 p-5 flex items-center gap-4">
                <div className="size-12 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                  <BankIcon />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[15px]">Plaid · secure bank verification</div>
                  <div className="text-[12px] text-fg-muted">12,000+ supported banks. Bank-grade encryption.</div>
                </div>
                <Button>Connect bank</Button>
              </div>
              <p className="mt-3 text-[12px] text-fg-muted">
                Prefer to upload statements? <a href="#" className="text-accent">Use the manual path.</a>
              </p>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={() => setStep('income')}>Back</Button>
              <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={() => setStep('soft-pull')}>
                Skip for now
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'soft-pull' && (
          <Card>
            <CardBody>
              <h1 className="text-[24px] font-semibold mb-1">Soft credit check consent</h1>
              <p className="text-[14px] text-fg-muted mb-5">
                We need your consent to pull a <strong>soft credit inquiry</strong>. This{' '}
                <span className="text-success font-medium">does not impact your credit score</span> and lets us
                show you real offers from real lenders.
              </p>

              <DisclosurePanel
                title="What we pull, why, and for whom"
                summary={
                  <>
                    A consumer credit report from Experian, used by EazePay and our bank + lender partners to
                    determine your eligibility and pricing. Permissible purpose: <strong>FCRA §604(a)(3)(A)</strong>.
                  </>
                }
                detail={
                  <>
                    <p>
                      You authorize EazePay, Inc. and its partner banks and lenders to obtain consumer reports
                      and information from credit bureaus, banks, and other sources for the purpose of evaluating
                      your application and any subsequent transactions. This is a <strong>soft inquiry</strong>{' '}
                      and is not reported to other lenders.
                    </p>
                    <p className="mt-2">
                      If you accept an offer, a hard inquiry may occur. The terms of the offer (APR, fees,
                      payments) will be disclosed in a TILA Truth-in-Lending box <em>before</em> you sign.
                    </p>
                    <p className="mt-2">
                      You may withdraw this authorization at any time, but doing so will end the application.
                      To exercise privacy rights under applicable state law (CCPA/CPRA, CDPA, CPA, etc.), see{' '}
                      <a className="text-accent" href="#">our state privacy rights portal</a>.
                    </p>
                  </>
                }
                acceptable
                accepted={acceptedDisclosure}
                onAcceptChange={setAcceptedDisclosure}
                defaultOpen
              />
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={() => setStep('bank')}>Back</Button>
              <Button
                disabled={!acceptedDisclosure}
                trailingIcon={<ArrowRightIcon size={14} />}
                onClick={() => {
                  setStep('loading');
                  setTimeout(() => setStep('offers'), 2200);
                }}
              >
                Give consent · See offers
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'loading' && (
          <Card>
            <CardBody className="py-16 text-center">
              <div className="inline-flex size-14 rounded-full bg-accent-soft text-accent items-center justify-center mb-5">
                <SparkIcon size={24} className="animate-pulse" />
              </div>
              <h2 className="text-[20px] font-semibold">We're checking eligibility with 4 lenders…</h2>
              <p className="mt-1 text-[14px] text-fg-muted">Usually takes 6–12 seconds.</p>
              <div className="mt-6 max-w-sm mx-auto space-y-2 text-left">
                {[
                  'Running OFAC + identity verification',
                  'Pulling soft credit inquiry (no score impact)',
                  'Routing across EazePay lender network',
                  'Compiling side-by-side offers',
                ].map((t, i) => (
                  <div key={t} className="flex items-center gap-2 text-[13px]">
                    <CheckIcon size={14} className="text-success" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {step === 'offers' && (
          <>
            <Banner intent="success" className="mb-4" title="3 offers — best to worst by total cost">
              You can see <strong>real terms</strong> from EazePay's network — no impact to your credit until you
              accept. Offers expire in 7 days.
            </Banner>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {offers.map((o) => (
                <Card key={o.id} className={o.id === selectedOfferId ? 'ring-2 ring-accent' : undefined}>
                  <CardBody>
                    <div className="flex items-center justify-between mb-3">
                      {o.isRecommended ? (
                        <StatusPill tone="accent">Best for you</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">{o.badge}</StatusPill>
                      )}
                      <span className="text-[11px] text-fg-muted">Made by {o.lenderOfRecord}</span>
                    </div>
                    <div className="text-[14px] font-semibold mb-1">{o.lender}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[28px] font-semibold tabular-nums">
                        <Money cents={o.monthlyCents} />
                      </span>
                      <span className="text-[13px] text-fg-muted">/mo · {o.termMonths}mo</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <DataRow label="APR" value={<Apr bps={o.aprBps} />} />
                      <DataRow label="Total of payments" value={<Money cents={o.totalCents} />} />
                      <DataRow label="Origination fee" value={<Money cents={o.feesCents} />} />
                      <DataRow label="Funded" value={<Money cents={o.financedCents} noFractions />} />
                    </div>
                  </CardBody>
                  <CardFooter>
                    <Button
                      fullWidth
                      variant={o.id === selectedOfferId ? 'primary' : 'secondary'}
                      onClick={() => {
                        setSelectedOfferId(o.id);
                        setStep('offer-detail');
                      }}
                    >
                      {o.id === selectedOfferId ? 'Continue with this offer' : 'Select this offer'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
            <p className="mt-4 text-[12px] text-fg-muted text-center">
              Default sort is lowest total cost. We never re-rank for EazePay revenue.
            </p>
          </>
        )}

        {step === 'offer-detail' && (() => {
          const o = offers.find((x) => x.id === selectedOfferId)!;
          return (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep('offers')}>← Back to offers</Button>
              <Card className="mt-3">
                <CardBody>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h1 className="text-[24px] font-semibold">{o.lender}</h1>
                      <p className="text-[13px] text-fg-muted">Loan made by {o.lenderOfRecord}, serviced by EazePay Servicing LLC.</p>
                    </div>
                    {o.isRecommended && <StatusPill tone="accent">Best for you</StatusPill>}
                  </div>

                  <div className="rounded-lg border border-border p-4 mb-5 bg-bg-muted/30">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
                      Federal Truth-in-Lending Disclosures
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div>
                        <div className="text-[20px] font-semibold tabular-nums"><Apr bps={o.aprBps} /></div>
                        <div className="text-[11px] text-fg-muted">Annual<br />Percentage Rate</div>
                      </div>
                      <div>
                        <div className="text-[20px] font-semibold tabular-nums"><Money cents={o.totalCents - o.financedCents} /></div>
                        <div className="text-[11px] text-fg-muted">Finance<br />Charge</div>
                      </div>
                      <div>
                        <div className="text-[20px] font-semibold tabular-nums"><Money cents={o.financedCents} noFractions /></div>
                        <div className="text-[11px] text-fg-muted">Amount<br />Financed</div>
                      </div>
                      <div>
                        <div className="text-[20px] font-semibold tabular-nums"><Money cents={o.totalCents} /></div>
                        <div className="text-[11px] text-fg-muted">Total of<br />Payments</div>
                      </div>
                    </div>
                  </div>

                  <DataRow label="Monthly payment" value={<Money cents={o.monthlyCents} />} />
                  <DataRow label="Term" value={`${o.termMonths} months`} />
                  <DataRow label="First payment due" value="June 14, 2026" />
                  <DataRow label="Late fee" value="$15 after 10 days past due" />
                  <DataRow label="Prepayment" value="No prepayment penalty" />
                  <DataRow label="Lender of record" value={o.lenderOfRecord} />
                  <DataRow label="Servicer" value="EazePay Servicing LLC" />
                  <DataRow label="Disbursement to" value="Pacific Solar Co. (your merchant)" />
                </CardBody>
                <CardFooter>
                  <Button variant="ghost" onClick={() => setStep('offers')}>Compare again</Button>
                  <Button trailingIcon={<ArrowRightIcon size={14} />} onClick={() => setStep('esign')}>
                    Continue to e-sign
                  </Button>
                </CardFooter>
              </Card>
            </>
          );
        })()}

        {step === 'esign' && (
          <Card>
            <CardBody>
              <h1 className="text-[24px] font-semibold mb-1">Sign your loan agreement</h1>
              <p className="text-[14px] text-fg-muted mb-5">
                Final disclosures are bundled below. By signing, you complete the credit contract and authorize
                ACH disbursement to your merchant.
              </p>

              <DisclosurePanel
                title="Loan agreement + payment authorization"
                summary={
                  <>
                    Federal credit contract with <strong>Cross River Bank</strong>, payment-method authorization
                    for monthly debits (EZ Check via HighSale, with a card-on-file backup via MiCamp), and
                    E-SIGN consent.
                  </>
                }
                detail={
                  <>
                    <p>
                      I, Marcus Tahir, hereby agree to the terms of the credit contract dated 2026-05-04 with
                      Cross River Bank (NMLS ID: 409249) for the amount of $19,500 at 8.49% APR over 60 months.
                      Monthly payments of $384.55 will be debited from my connected bank account beginning June 14, 2026.
                    </p>
                    <p className="mt-2">
                      I authorize Cross River Bank, EazePay Servicing LLC, and their servicing processors —
                      including HighSale (EZ Check / RCC + Web-debit) and MiCamp (card-on-file backup) — to
                      initiate ACH or card debits in accordance with Nacha rules and Reg E. I understand I may
                      revoke this authorization at any time by providing written notice at least 3 business days
                      prior to the next scheduled debit.
                    </p>
                    <p className="mt-2">
                      Pre-debit notices are sent at least 10 days before each scheduled payment. If an EZ Check
                      debit fails, EazePay will attempt the backup card-on-file before escalating to the hardship
                      pathway.
                    </p>
                  </>
                }
                acceptable
                accepted={acceptedDisclosure}
                onAcceptChange={setAcceptedDisclosure}
                defaultOpen
              />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-bg-elevated p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] uppercase tracking-wider text-fg-muted font-semibold">
                      Primary debit
                    </span>
                    <StatusPill tone="success">EZ Check · HighSale</StatusPill>
                  </div>
                  <div className="text-[13px] font-medium">Chase checking ••••2104</div>
                  <div className="text-[12px] text-fg-muted">Verified via Plaid · same-day ACH eligible</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-elevated p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] uppercase tracking-wider text-fg-muted font-semibold">
                      Backup card-on-file
                    </span>
                    <StatusPill tone="info">Card · MiCamp</StatusPill>
                  </div>
                  <div className="text-[13px] font-medium">Visa debit ••••4198</div>
                  <div className="text-[12px] text-fg-muted">Used only if the EZ Check rail returns a debit</div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border-2 border-dashed border-border p-8 flex flex-col items-center justify-center">
                <p className="text-[12px] uppercase tracking-wider font-semibold text-fg-muted">Tap to sign</p>
                <div className="mt-3 text-[36px] font-handwritten italic text-fg-secondary" style={{ fontFamily: 'cursive' }}>
                  Marcus Tahir
                </div>
                <p className="mt-3 text-[12px] text-fg-muted text-center">
                  Your signature is captured electronically under the E-SIGN Act and your state UETA equivalent.
                </p>
              </div>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={() => setStep('offer-detail')}>Back</Button>
              <Button
                disabled={!acceptedDisclosure}
                trailingIcon={<ArrowRightIcon size={14} />}
                onClick={() => setStep('funded')}
              >
                Sign & fund
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 'funded' && (
          <Card>
            <CardBody className="py-12 text-center">
              <div className="inline-flex size-16 rounded-full bg-success-bg text-success items-center justify-center mb-5">
                <CheckIcon size={28} />
              </div>
              <h1 className="text-[28px] font-semibold">You're funded.</h1>
              <p className="mt-2 text-[14px] text-fg-muted">
                Cross River Bank is releasing <Money cents={1_950_000} noFractions /> to Pacific Solar Co. via RTP. Funds typically settle within minutes.
              </p>
              <div className="mt-7 max-w-md mx-auto text-left">
                <DataRow label="Loan ID" value={<span className="font-mono text-[12px]">loan_8KvR2NQp</span>} />
                <DataRow label="Disbursement to" value="Pacific Solar Co." />
                <DataRow label="First payment" value="June 14, 2026 · $384.55" />
                <DataRow label="Manage in app" value="EazePay (iOS / Android)" />
              </div>
              <Button size="lg" className="mt-7" trailingIcon={<ArrowRightIcon size={14} />}>Download EazePay app</Button>
              <p className="mt-4 text-[12px] text-fg-muted">
                A copy of your signed agreement + TILA disclosure has been emailed to marcus.t@gmail.com.
              </p>
            </CardBody>
          </Card>
        )}
      </main>
    </div>
  );
}
