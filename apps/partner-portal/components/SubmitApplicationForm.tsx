'use client';
import { useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardFooter,
  Button,
  Input,
  Select,
  Textarea,
  StatusPill,
  Stepper,
  Banner,
  ArrowRightIcon,
  CheckIcon,
} from '@eazepay/ui/web';

export interface SubmitFormSpec {
  brand: string;
  brandColor: string;
  vertical: string;
  productCode: string;
  amountPlaceholder: string;
  termOptions: Array<{ value: string; label: string }>;
  purposeOptions: Array<{ value: string; label: string }>;
}

const stepperItems = [
  { key: 'customer', label: 'Customer', description: 'Identity + contact' },
  { key: 'amount', label: 'Amount', description: 'How much + term' },
  { key: 'context', label: 'Service context', description: 'What it funds' },
  { key: 'submit', label: 'Submit', description: 'Route to lenders' },
];

export function SubmitApplicationForm({ spec }: { spec: SubmitFormSpec }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const next = () => {
    if (step < stepperItems.length - 1) setStep(step + 1);
    else setDone(true);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Submit Application' }, { label: spec.brand }]}
        title={`Submit a ${spec.brand} application`}
        description={`Refer a customer for ${spec.brand} financing. EazePay handles identity, eligibility, and offer presentation — you get a status webhook the moment something changes.`}
        meta={
          <>
            <span className="inline-flex items-center gap-2 text-[13px]">
              <span className="size-2.5 rounded-full" style={{ background: spec.brandColor }} />
              <span className="font-medium">{spec.brand}</span>
              <span className="text-fg-muted">· {spec.vertical}</span>
            </span>
            <StatusPill tone="info">Soft-pull only · no score impact</StatusPill>
          </>
        }
      />
      <PageBody>
        {done ? (
          <Card>
            <CardBody className="py-14 text-center">
              <div className="inline-flex size-14 rounded-full bg-success-bg text-success items-center justify-center mb-4">
                <CheckIcon size={28} />
              </div>
              <h2 className="text-[22px] font-semibold">Application submitted.</h2>
              <p className="mt-2 text-[14px] text-fg-muted max-w-md mx-auto">
                Your customer will receive a secure link to verify identity and review offers. Status
                events fire to your configured webhook in real time.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button onClick={() => { setStep(0); setDone(false); }}>Submit another</Button>
                <Button variant="ghost">Open application status</Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <>
            <Stepper items={stepperItems} activeIndex={step} className="mb-7" />

            <Card>
              <CardBody>
                {step === 0 && (
                  <>
                    <h3 className="text-[18px] font-semibold mb-1">Who are you referring?</h3>
                    <p className="text-[13px] text-fg-muted mb-5">We send the secure link to the email below.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="First name" required />
                      <Input label="Last name" required />
                      <Input label="Email" type="email" required />
                      <Input label="Mobile" type="tel" required />
                      <Input label="Date of birth" type="date" required />
                      <Input label="ZIP / Postal code" required />
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <h3 className="text-[18px] font-semibold mb-1">How much, and over how long?</h3>
                    <p className="text-[13px] text-fg-muted mb-5">
                      Orchestration will surface ranked offers around this target — but lenders may
                      counter with adjacent amounts and terms.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="Requested amount (USD)"
                        leadingIcon={<span className="text-fg-muted">$</span>}
                        placeholder={spec.amountPlaceholder}
                        required
                      />
                      <Select label="Term preference" options={spec.termOptions} required />
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <h3 className="text-[18px] font-semibold mb-1">What is the financing for?</h3>
                    <p className="text-[13px] text-fg-muted mb-5">
                      Service context helps us route to the right lender mix. The customer never sees the
                      pitch wording — it's a routing signal only.
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      <Select label="Service category" options={spec.purposeOptions} required />
                      <Textarea label="Service / job description" placeholder="One sentence summary — what's being financed." />
                      <Input label="Estimated start date" type="date" />
                    </div>
                  </>
                )}
                {step === 3 && (
                  <>
                    <h3 className="text-[18px] font-semibold mb-1">Submit to orchestration</h3>
                    <p className="text-[13px] text-fg-muted mb-5">
                      EazePay sends the secure apply link to the customer, runs identity + soft pull, then
                      routes across eligible lenders. You'll get a status webhook within seconds.
                    </p>
                    <Banner intent="info">
                      Product: <strong>{spec.brand}</strong> · code <span className="font-mono text-[12px]">{spec.productCode}</span>
                      <br />
                      No charge is made to the customer at this step. Soft credit pull only.
                    </Banner>
                  </>
                )}
              </CardBody>
              <CardFooter>
                <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</Button>
                <Button
                  trailingIcon={step === stepperItems.length - 1 ? <CheckIcon size={14} /> : <ArrowRightIcon size={14} />}
                  onClick={next}
                >
                  {step === stepperItems.length - 1 ? 'Submit' : 'Continue'}
                </Button>
              </CardFooter>
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}
