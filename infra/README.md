# EazePay Infrastructure

Terraform-driven AWS infrastructure for the EazePay platform. US regions
only (`us-east-1` primary, `us-west-2` DR per ARCHITECTURE.md §10.5),
multi-account AWS Organizations layout.

## Layout

```
infra/terraform/
├── envs/
│   ├── dev/        # shared dev account
│   ├── staging/    # prod-like
│   └── prod/       # production
└── modules/
    ├── network/         VPC + subnets (3 AZ public/private/isolated)
    ├── aurora/          Aurora PostgreSQL cluster + Global Database
    ├── ecs-service/     ECS Fargate task + service + ALB target group
    ├── redis/           ElastiCache Redis (cluster mode disabled, AZ-redundant)
    ├── kms/             KMS CMKs per data class (PII / docs / payments)
    ├── secrets/         Secrets Manager bootstrap
    ├── cloudfront-waf/  CloudFront distribution with AWS-managed WAF rules
    └── s3-bucket/       Encrypted bucket with optional Object Lock
```

## State

Remote state in S3 with DynamoDB locking, KMS-encrypted, **per env**.
Bootstrap (one-time) is a separate stack documented in
`runbooks/terraform-bootstrap.md`.

## Apply path

PR-driven plan via Atlantis (or Terraform Cloud); manual-approved
apply. Production applies require two reviewers per CODEOWNERS.

## Multi-account

Per ARCHITECTURE.md, six AWS accounts under Organizations:
`prod`, `staging`, `dev`, `sandbox`, `audit` (write-once CloudTrail

- Config landing zone), `security` (GuardDuty + Security Hub
  delegated administrator), `shared-services`. Cross-account roles
  defined in `modules/iam-cross-account` (lands when bank-partner
  diligence demands it).

## What's here vs. NOT here

These modules are **scaffolds**. Variable contracts, resource
shape, naming, and tags are correct and production-ready in
structure. What's missing:

- Real account ids / KMS key arns (placeholders)
- Actual subnet CIDRs (using `var.cidr_block`)
- WAF rule sets beyond the AWS-managed baseline
- AppConfig + feature-flag plumbing
- CI deploy roles for GitHub Actions OIDC

Those come with the production AWS account setup. Today the modules
let you read the shape and start filling in.

See ADR-0006 for the IaC + Terraform decision rationale.
