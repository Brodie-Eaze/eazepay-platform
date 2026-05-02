# ADR-0006: Terraform for infrastructure-as-code on AWS

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO)

## Context

Multi-account AWS Organizations setup (`prod`, `staging`, `dev`, `sandbox`, `audit`, `security`, `shared-services`) with US-only SCPs. Infra changes need PR-driven plan + manual-approved apply, distinct from product code.

## Decision

- Terraform (not CDK) for all AWS resources, modular per concern.
- Remote state in S3 with DynamoDB locks per environment, KMS-encrypted.
- PR-driven plan via Atlantis or Terraform Cloud; manual apply gate.
- GitHub Actions OIDC to AWS — no long-lived deployment keys anywhere.
- Lives in a separate `eazepay/infra` repo (per ADR-0001) with its own approver set.

## Alternatives considered

- **AWS CDK:** strong DX in TypeScript, but smaller community, weaker module ecosystem for fintech-specific patterns, and harder to hire for in 2026.
- **Pulumi:** capable, but non-standard in regulated AWS environments — auditors and bank-partner teams expect Terraform.

## Consequences

- Module library to build: VPC, Aurora, ECS service, ECR, ALB, KMS, IAM roles, WAF, CloudFront distribution, Secrets Manager bootstrap.
- tfsec + checkov in CI; both must pass before plan is approved.
- Drift detection runs nightly; any drift opens a PR.

## Compliance / risk notes

CloudTrail flows to a separate `audit` account with object lock. Terraform never writes secrets to state in plaintext (use `aws_secretsmanager_secret_version` with `ignore_changes`).
