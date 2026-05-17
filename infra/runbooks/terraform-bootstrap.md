# Terraform Bootstrap

One-time setup for the Terraform state backend and OIDC trust between
GitHub Actions and AWS. **Runs ONCE per AWS account**, before any env
stack applies.

## Prereqs

- A clean AWS account (one of: `dev`, `staging`, `prod`, `audit`,
  `security`, `shared-services`).
- `aws` CLI configured for that account with admin credentials.
- This repo cloned locally.

## Steps

1. Create the state bucket + lock table:

   ```bash
   aws s3api create-bucket --bucket eazepay-tfstate-<env> --region us-east-1
   aws s3api put-bucket-versioning --bucket eazepay-tfstate-<env> \
     --versioning-configuration Status=Enabled
   aws s3api put-bucket-encryption --bucket eazepay-tfstate-<env> \
     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"alias/aws/s3"}}]}'
   aws dynamodb create-table --table-name eazepay-tfstate-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

2. Create the GitHub Actions OIDC provider + a deployment role with
   minimum-needed policies for the env. The role's trust policy
   restricts which repos / refs can assume it.

3. Apply the env stack:
   ```bash
   cd infra/terraform/envs/<env>
   terraform init
   terraform plan
   terraform apply  # production = manual review per CODEOWNERS
   ```

## Things this script does NOT do

- Create the AWS Organizations multi-account layout (Control Tower /
  AFT does that out of band).
- Set up GuardDuty / Security Hub / Config delegated administration
  (lives in the `security` and `audit` accounts).
- Enable CloudTrail multi-region multi-account → audit account
  (requires `audit` account access).

Those land when the production AWS account opens.
