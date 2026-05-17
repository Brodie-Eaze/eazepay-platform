import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  StatusPill,
  Banner,
  Button,
  DataRow,
  Money,
  Sparkline,
  ArrowRightIcon,
  BankIcon,
  WebhookIcon,
  CheckIcon,
} from '@eazepay/ui/web';

const cardTrend = [612, 580, 620, 590, 540, 580, 612, 660, 700, 680, 612, 640, 680];
const ezCheckTrend = [128, 142, 156, 160, 175, 162, 188, 192, 201, 197, 188, 211, 218];

export default function ProcessorsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Processors' }]}
        title="Payment processors"
        description="Live health, settlement cadence, and operational config for every money-movement integration."
        actions={
          <>
            <Button variant="ghost">Reconciliation</Button>
            <Button>Open processor inbox</Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard
            label="Card volume (today)"
            value={<Money cents={428_140_00} compact />}
            delta={{ value: '+14%', direction: 'up', isGood: true }}
            series={cardTrend}
            hint="via MiCamp · auths + captures"
          />
          <KpiCard
            label="EZ Check volume (today)"
            value={<Money cents={184_220_00} compact />}
            delta={{ value: '+22%', direction: 'up', isGood: true }}
            series={ezCheckTrend}
            hint="via HighSale · RCC + Web-debit"
          />
          <KpiCard
            label="Authorization rate (24h)"
            value="94.8%"
            delta={{ value: '+0.4pp', direction: 'up', isGood: true }}
            hint="cards · gross of recycling"
          />
          <KpiCard
            label="Return rate (Nacha 60d)"
            value="0.31%"
            delta={{ value: '-0.04pp', direction: 'down', isGood: true }}
            hint="Unauthorized ≤ 0.5% Nacha cap"
          />
        </div>

        <Banner intent="info" className="mb-4">
          MiCamp and HighSale each settle to the EazePay operating account at Cross River. Daily
          reconciliation runs at 06:00 ET and posts breaks to the processor inbox.
        </Banner>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-3">
                  MiCamp
                  <StatusPill tone="success" dot>
                    Live
                  </StatusPill>
                </span>
              }
              description="Single-stack acquirer for card-present, card-not-present, and stored-credential transactions across all brands."
              action={
                <Button size="sm" variant="ghost">
                  Manage
                </Button>
              }
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <DataRow
                    label="Account"
                    value={<span className="font-mono text-[12px]">micamp_acct_8KvR2N</span>}
                  />
                  <DataRow
                    label="MID"
                    value={<span className="font-mono text-[12px]">444•••••3120</span>}
                  />
                  <DataRow label="Processor" value="First Data / Fiserv (downstream)" />
                  <DataRow
                    label="3DS"
                    value={<StatusPill tone="success">Enabled · risk-based</StatusPill>}
                  />
                  <DataRow label="Tokenization" value="Network · Visa + Mastercard ATC" />
                </div>
                <div>
                  <DataRow label="Funding cadence" value="T+1 · same-day on opt-in" />
                  <DataRow label="Reserve" value="0% (graduated)" />
                  <DataRow label="Dispute fee" value="$15 · refunded if won" />
                  <DataRow
                    label="Risk monitor"
                    value={
                      <StatusPill tone="success" dot>
                        Healthy
                      </StatusPill>
                    }
                  />
                  <DataRow label="Auth rate (rolling)" value="94.8%" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="secondary" leadingIcon={<WebhookIcon size={14} />}>
                  Webhooks
                </Button>
                <Button size="sm" variant="secondary">
                  Open API key
                </Button>
                <Button size="sm" variant="ghost" leadingIcon={<ArrowRightIcon size={14} />}>
                  Settlement report
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-3">
                  HighSale
                  <StatusPill tone="success" dot>
                    Live · EZ Check
                  </StatusPill>
                </span>
              }
              description="Electronic-check processor — RCC (remotely-created checks), Web-debit, and tele-check rails for one-time and recurring debits."
              action={
                <Button size="sm" variant="ghost">
                  Manage
                </Button>
              }
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <DataRow
                    label="Account"
                    value={<span className="font-mono text-[12px]">hs_acct_R2NQp8</span>}
                  />
                  <DataRow label="Rail" value="RCC + WEB · same-day ACH available" />
                  <DataRow label="Auth method" value="Plaid Auth · micro-deposits fallback" />
                  <DataRow
                    label="Reg E coverage"
                    value={<StatusPill tone="success">Consumer · in scope</StatusPill>}
                  />
                  <DataRow label="Tokenization" value="Vault-stored routing + account" />
                </div>
                <div>
                  <DataRow label="Funding cadence" value="T+1 · same-day on opt-in" />
                  <DataRow
                    label="Pre-debit notice"
                    value={<StatusPill tone="success">10-day enforced</StatusPill>}
                  />
                  <DataRow label="Return rate (60d)" value="0.31%" />
                  <DataRow label="Unauth return (60d)" value="0.04%" />
                  <DataRow
                    label="Risk monitor"
                    value={
                      <StatusPill tone="success" dot>
                        Healthy
                      </StatusPill>
                    }
                  />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="secondary" leadingIcon={<WebhookIcon size={14} />}>
                  Webhooks
                </Button>
                <Button size="sm" variant="secondary">
                  Open API key
                </Button>
                <Button size="sm" variant="ghost" leadingIcon={<ArrowRightIcon size={14} />}>
                  Return-rate report
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader
              title="Money-movement flow"
              description="How funds move across rails on a typical loan disbursement and a typical repayment."
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-2">
                    Disbursement
                  </div>
                  <ol className="space-y-2 text-[13px]">
                    {[
                      ['1.', 'Loan funded by partner bank (Cross River) on e-sign'],
                      ['2.', 'EazePay disburses to merchant operating account via RTP'],
                      ['3.', 'Funds available to merchant same-day (RTP) or T+1 (ACH fallback)'],
                      ['4.', 'Audit-chain receipt + webhook fired to merchant'],
                    ].map(([n, t]) => (
                      <li key={n} className="flex items-start gap-2">
                        <span className="font-mono text-fg-muted shrink-0">{n}</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-2">
                    Repayment
                  </div>
                  <ol className="space-y-2 text-[13px]">
                    {[
                      ['1.', 'Consumer auto-pay debited via MiCamp (card) or HighSale (EZ Check)'],
                      ['2.', 'Funds settle to EazePay servicing account at Cross River'],
                      ['3.', 'Daily sweep to bank-of-record (true lender) per servicing agreement'],
                      [
                        '4.',
                        'Return-rate monitoring against Nacha caps; failed debits enter dunning',
                      ],
                    ].map(([n, t]) => (
                      <li key={n} className="flex items-start gap-2">
                        <span className="font-mono text-fg-muted shrink-0">{n}</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
