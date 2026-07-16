# eazepay AWS Terraform — `infra/aws/`

Production AWS stack for the Railway -> AWS migration. Greenfield prod
account. Single-operator (Brodie), single-region (us-east-1).

## Quick reference

| File                       | Owns                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `versions.tf`              | Terraform/provider pins, S3 backend block (commented until bootstrap) |
| `providers.tf`             | AWS provider, default tags, account-id safety check                   |
| `variables.tf`             | All input variables (region, account, services map, sizing)           |
| `terraform.tfvars.example` | Operator template — copy to `terraform.tfvars` (git-ignored)          |
| `vpc.tf`                   | VPC, 3-AZ public+private subnets, NAT GWs, S3 gateway endpoint        |
| `security_groups.tf`       | ALB / ECS / RDS / Redis / VPCE SGs — default-deny                     |
| `kms.tf`                   | KEK (envelope) + data (at-rest) keys + aliases                        |
| `s3.tf`                    | audit (Object Lock 7y), artifacts, tfstate buckets + DynamoDB lock    |
| `secrets.tf`               | 12 Secrets Manager shells with placeholder values                     |
| `ecr.tf`                   | 14 ECR repos, lifecycle policies, image scan on push                  |
| `rds.tf`                   | Postgres 16 Multi-AZ, KMS-encrypted, deletion-protected               |
| `elasticache.tf`           | Redis 7 single-node (SCALE TO MULTI-NODE BEFORE PROD TRAFFIC)         |
| `iam.tf`                   | Task exec role (shared) + per-service task roles                      |
| `alb.tf`                   | Public ALB, HTTPS 443 with ACM cert, target groups, listener rules    |
| `ecs_cluster.tf`           | ECS cluster, Container Insights, exec-command logging                 |
| `ecs_services.tf`          | Per-service task def + service + autoscaling                          |
| `cloudwatch.tf`            | Log groups (90d), billing/CPU/storage/5xx alarms, SNS ops topic       |
| `route53.tf`               | Zone data source, app subdomain record (commented until cutover)      |

## CRITICAL — do not commit `terraform.tfvars`

`terraform.tfvars` is git-ignored by the repo root `.gitignore`
(`*.tfvars` is added below). It contains `aws_account_id` and any
operator overrides. Use `terraform.tfvars.example` as the template.

## Bootstrap procedure (chicken-and-egg solved)

The S3 backend bucket has to exist BEFORE Terraform can use it for
state, but we manage that bucket WITH Terraform. Solution: first
apply runs with LOCAL state, creates the bucket + DynamoDB lock,
then we flip the backend and migrate.

### Step 0: prerequisites

- AWS account exists, root MFA enabled
- IAM admin user/role created out-of-band with break-glass procedure
- AWS CLI configured locally: `aws sts get-caller-identity` returns
  the expected account
- Domain registered + Route53 hosted zone created (out-of-band — we
  read it as a data source)
- ACM certificate REQUESTED + ISSUED for `*.eazepay.com` in
  `us-east-1`, DNS-validated:

  ```sh
  aws acm request-certificate \
    --domain-name '*.eazepay.com' \
    --subject-alternative-names 'eazepay.com' \
    --validation-method DNS \
    --region us-east-1
  # follow the CNAME records returned; wait for status ISSUED
  ```

### Step 1: configure tfvars

```sh
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars   # set aws_account_id at minimum
```

### Step 2: first apply (local state)

```sh
terraform init    # NO backend yet; local state in terraform.tfstate
terraform fmt -recursive
terraform validate
terraform plan -out plan.out
# review plan carefully — expect ~150-200 resources created
terraform apply plan.out
```

**What this creates (relevant for bootstrap):**

- `eazepay-tfstate-<account-id>` S3 bucket
- `eazepay-tfstate-lock` DynamoDB table
- Everything else (VPC, RDS, ECS, etc.)

### Step 3: migrate state to S3

Uncomment the `backend "s3"` block in `versions.tf`, set
`bucket = "eazepay-tfstate-<your-account-id>"`, then:

```sh
terraform init -migrate-state
# answer "yes" when asked to copy local state to S3
```

Verify migration worked:

```sh
aws s3 ls s3://eazepay-tfstate-<account-id>/prod/
# should show terraform.tfstate
terraform plan
# should report "No changes" — drift would be a problem
```

Delete the local state files (they're now redundant + a leak risk):

```sh
rm terraform.tfstate terraform.tfstate.backup
```

### Step 4: fill in real secret values

Secrets Manager has 12 shells + 2 auto-managed (RDS, Redis). Replace
the placeholder for each app secret via AWS CLI:

```sh
ENV=prod

# DATABASE_URL — construct from RDS endpoint + master credentials
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
RDS_USER=$(aws secretsmanager get-secret-value --secret-id /$ENV/eazepay/rds/master-credentials --query SecretString --output text | jq -r .username)
RDS_PASS=$(aws secretsmanager get-secret-value --secret-id /$ENV/eazepay/rds/master-credentials --query SecretString --output text | jq -r .password)
aws secretsmanager put-secret-value \
  --secret-id /$ENV/eazepay/DATABASE_URL \
  --secret-string "postgresql://${RDS_USER}:${RDS_PASS}@${RDS_ENDPOINT}/eazepay?sslmode=require"

# REDIS_URL — construct from Redis endpoint + auth token
REDIS_ENDPOINT=$(terraform output -raw redis_primary_endpoint)
REDIS_AUTH=$(aws secretsmanager get-secret-value --secret-id /$ENV/eazepay/redis/auth-token --query SecretString --output text)
aws secretsmanager put-secret-value \
  --secret-id /$ENV/eazepay/REDIS_URL \
  --secret-string "rediss://default:${REDIS_AUTH}@${REDIS_ENDPOINT}:6379"

# Generate random cookie secrets (32+ bytes each)
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/DEMO_COOKIE_SECRET --secret-string "$(openssl rand -base64 48)"
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/ACCOUNT_COOKIE_SECRET --secret-string "$(openssl rand -base64 48)"

# Vendor secrets — paste from the vendor dashboards
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/STRIPE_SECRET_KEY  --secret-string 'sk_live_...'
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/RESEND_API_KEY     --secret-string 're_...'
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/MICAMP_WEBHOOK_SECRET   --secret-string 'whsec_...'
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/HIGHSALE_WEBHOOK_SECRET --secret-string 'whsec_...'
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/PUSHER_APP_ID --secret-string '...'
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/PUSHER_KEY    --secret-string '...'
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/PUSHER_SECRET --secret-string '...'
aws secretsmanager put-secret-value --secret-id /$ENV/eazepay/PUSHER_CLUSTER --secret-string 'us2'
```

### Step 5: push container images to ECR

```sh
ACCOUNT=<account-id>
REGION=us-east-1
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com

# For each service (CI handles this normally):
SERVICE=partner-portal
SHA=$(git rev-parse --short HEAD)
docker build --platform linux/arm64 -f Dockerfile -t $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/eazepay/$SERVICE:$SHA .
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/eazepay/$SERVICE:$SHA

# Update the ECS service to use the new image (CI script equivalent):
aws ecs update-service --cluster eazepay-prod --service eazepay-prod-$SERVICE --force-new-deployment
```

### Step 6: verify health

```sh
# ALB target health
ALB_ARN=$(terraform output -raw alb_dns_name)
echo "ALB DNS: $ALB_ARN"
curl -sI https://$ALB_ARN/api/health -H 'Host: app.eazepay.com'

# ECS tasks running
aws ecs list-services --cluster eazepay-prod
aws ecs describe-services --cluster eazepay-prod --services $(aws ecs list-services --cluster eazepay-prod --query 'serviceArns[]' --output text)
```

### Step 7: subscribe to ops alerts

```sh
TOPIC_ARN=$(terraform output -raw ops_alerts_topic_arn)
aws sns subscribe --topic-arn $TOPIC_ARN --protocol email --notification-endpoint brodie@amalafinance.com.au
# confirm via email link
```

### Step 8: DNS cutover

When ready to flip traffic from Railway:

1. Uncomment the `aws_route53_record "app"` (and `app_aaaa`) blocks
   in `route53.tf`
2. `terraform plan` — expect 2 records created
3. `terraform apply`
4. Watch DNS propagation: `dig +short app.eazepay.com` — should
   return ALB IPs within 60s (Route53 alias TTL is short)
5. Smoke test via real domain
6. Decommission Railway endpoint AFTER 24h of healthy AWS traffic

## Deploy sequence (steady state)

Day-2 operations after bootstrap:

1. CI builds image, pushes to ECR with tag `<git-sha>`
2. CI calls `aws ecs update-service --force-new-deployment` (or
   updates task def + service)
3. ECS rolls deployment with circuit breaker enabled — auto-rollback
   on failed deploy (deployment_circuit_breaker in `ecs_services.tf`)
4. CloudWatch alarms fire on SNS if 5xx/CPU spikes

Terraform changes (infrastructure):

1. `terraform plan -out plan.out`
2. Self-review (or send to Council via [[infra-reviewer]] skill)
3. `terraform apply plan.out`

## Rollback procedures

### Failed app deploy

ECS deployment circuit breaker auto-rolls back. If manual:

```sh
PREVIOUS_TASK_DEF_ARN=<previous from aws ecs list-task-definitions>
aws ecs update-service --cluster eazepay-prod --service eazepay-prod-<svc> --task-definition $PREVIOUS_TASK_DEF_ARN
```

### Failed Terraform apply

```sh
# View state of last apply
terraform state list
# Revert the .tf change in git
git revert <commit>
terraform plan -out rollback.out
terraform apply rollback.out
```

### Database point-in-time recovery

```sh
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier eazepay-prod \
  --target-db-instance-identifier eazepay-prod-recovery \
  --restore-time "2026-05-27T12:00:00Z" \
  --db-subnet-group-name eazepay-prod-rds \
  --vpc-security-group-ids <rds-sg-id>
# then re-point DATABASE_URL secret + redeploy
```

### Full region failure

Out of scope for this stack (single-region). DR plan in
`docs/disaster-recovery.md` (or per [[disaster-recovery-plan]] skill).

## Cost estimate (us-east-1, on-demand, ~steady-state v1)

| Item                                   | Approx monthly |
| -------------------------------------- | -------------- |
| 3x NAT Gateway                         | $96 + data     |
| RDS db.t4g.medium Multi-AZ             | $130           |
| RDS storage gp3 100GB                  | $12            |
| ElastiCache cache.t4g.micro            | $12            |
| ALB                                    | $20 + LCUs     |
| ECS Fargate (28 vCPU-hrs/day baseline) | ~$120          |
| ECR storage (14 repos x ~5GB)          | $7             |
| Secrets Manager (14 secrets)           | $6             |
| CloudWatch logs + metrics              | $20            |
| S3 (modest writes)                     | $5             |
| KMS (2 keys + API calls)               | $2             |
| Data transfer                          | varies         |
| **Subtotal**                           | **~$430/mo**   |

CloudWatch billing alarm fires at $500/mo (`cloudwatch.tf`).
Reserved Instances for RDS + Savings Plan for Fargate after 30 days
of steady-state observation can drop this 30-40%.

## Security posture summary

- All resources tagged (`Project`, `Env`, `ManagedBy`, `Repo`,
  `CostCenter`, `Owner`)
- VPC: private subnets for compute + data; only ALB in public
- SGs: default-deny, SG-ref (not CIDR) for service-to-service
- Encryption-at-rest: customer KMS for RDS, S3, ElastiCache,
  CloudWatch logs, Secrets Manager
- Encryption-in-transit: TLS 1.2+ on ALB, SSL forced on RDS,
  TLS on Redis with AUTH token
- KMS key rotation enabled (annual)
- S3 audit bucket: Object Lock GOVERNANCE, 7y retention, Glacier
  transition after 90d
- IAM: least privilege per service; no human users; no long-lived
  access keys; per-service task roles
- Secrets: never in env vars at build, never in TF plaintext;
  Secrets Manager with KMS encryption
- ECR: image scanning on push, immutable tags
- ECS: read-only root filesystem, init process, KMS-encrypted
  exec-command sessions
- Auto-rollback on failed deploys (deployment circuit breaker)
- CloudWatch alarms: billing, CPU, storage, 5xx
- ALB access logs to S3

## Open hardening items (post-bootstrap)

- [ ] WAFv2 in front of ALB (rate limiting, OWASP rule sets)
- [ ] GuardDuty enabled
- [ ] AWS Config rules for compliance drift detection
- [ ] Security Hub baseline (CIS, PCI DSS standards)
- [ ] Flip ElastiCache to multi-node with `automatic_failover_enabled`
- [ ] VPC Flow Logs to CloudWatch
- [ ] Secrets Manager rotation Lambda for app secrets that support it
- [ ] CloudTrail organization trail (if/when we add Organizations)
- [ ] Per-service security groups (currently shared ECS task SG)
- [ ] Tighten per-service secret access (currently all services see all secrets)
- [ ] cosign signing of ECR images in CI; verify on deploy

## Related skills

- [[ci-cd-pipeline-design]] — GH Actions wiring for ECR push + ECS update
- [[blue-green-canary]] — flip default rolling to canary for payment service
- [[disaster-recovery-plan]] — full DR runbook
- [[secrets-sweep]] — verify nothing leaked in repo
- [[dependency-supply-chain]] — image scanning + cosign signing
- [[pii-first-design]] — KEK envelope encryption pattern
