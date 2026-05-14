import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Banner,
  Button,
  DataRow,
  StatusPill,
  CodeBlock,
} from '@eazepay/ui/web';

export default function PoliciesPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Policies & rules' }]}
        title="Policies & rules"
        description="Declarative rule packs that drive orchestration: knockouts, eligibility, fair-lending compliance, MLA/SCRA gates. Versioned + PR-reviewed; every decision references a version."
      />
      <PageBody>
        <Banner intent="info" className="mb-4">
          Rule changes ship through PR with compliance + risk reviewer signoff. A 24h shadow window
          compares old vs. new decision distribution before live promotion. <strong>No silent edits.</strong>
        </Banner>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Active orchestration policy" action={<StatusPill tone="success" dot>Live</StatusPill>} />
            <CardBody>
              <DataRow label="Version" value={<span className="font-mono text-[12px]">orch_v_2026_05_a</span>} />
              <DataRow label="Promoted" value="2026-05-01 09:00 ET" />
              <DataRow label="Author" value="rules-pack-pr-#412" />
              <DataRow label="Shadow window decisions" value="14,228 — Δ approval ≤ 0.4pp" />
              <DataRow label="Reviewers" value="3 of 3 (risk, compliance, ops)" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="State coverage matrix" />
            <CardBody>
              <DataRow label="Direct-licensed states" value="0" />
              <DataRow label="Bank-partner exported (CRB)" value="41" />
              <DataRow label="Bank-partner exported (FinWise)" value="36" />
              <DataRow label="Excluded states" value="—" />
              <DataRow label="MLA covered-borrower path" value="Enforced" />
              <DataRow label="SCRA flag path" value="Enforced (6% rate cap)" />
            </CardBody>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader title="Knockout rule (sample)" description="Declarative rule pack — same source of truth in dev, staging, and prod." />
            <CardBody>
              <CodeBlock language="yaml" filename="orch/knockouts.yml">{`# Orchestration knockouts — evaluated before any lender call.
# Returns immediate ineligible with reason code; no soft pull, no spend.

- id: ko_age_minor
  description: Applicant under 18.
  when: applicant.age_years < 18
  reason: applicant_under_age
  audience_facing: "You must be 18 or older to apply."

- id: ko_state_unsupported
  description: Applicant in a non-supported state.
  when: state_matrix.allowed(applicant.state) == false
  reason: state_residence_unsupported
  audience_facing: "EazePay is not yet available in your state."

- id: ko_ofac_sdn
  description: Applicant or co-applicant on OFAC SDN list.
  when: ofac.sdn.match(applicant.legal_name, applicant.dob) == true
  reason: ofac_sdn_match
  audit: open_compliance_review

- id: ko_mla_36pct
  description: MLA-covered borrower with proposed MAPR > 36%.
  when: applicant.mla_covered == true and offer.mapr_bps > 3600
  reason: mla_mapr_cap_exceeded`}</CodeBlock>
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
