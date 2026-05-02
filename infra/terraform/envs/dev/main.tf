/**
 * Dev environment composition. Wires the modules together for the
 * shared dev account. Outputs ARNs the application code reads at
 * runtime via Secrets Manager / Parameter Store.
 *
 * State backend: S3 + DynamoDB lock (configured in backend.tf,
 * created out-of-band by the bootstrap stack).
 */
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Env         = "dev"
      Project     = "eazepay"
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront/WAF require us-east-1 explicitly.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

variable "azs" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# ----- KMS keys per data class -----
module "kms_pii" {
  source     = "../../modules/kms"
  name       = "eazepay-dev-pii"
  data_class = "pii"
  alias      = "alias/eazepay/dev/pii"
  key_admins = []
  key_users  = []
}

module "kms_documents" {
  source     = "../../modules/kms"
  name       = "eazepay-dev-documents"
  data_class = "documents"
  alias      = "alias/eazepay/dev/documents"
  key_admins = []
  key_users  = []
}

module "kms_logs" {
  source     = "../../modules/kms"
  name       = "eazepay-dev-logs"
  data_class = "logs"
  alias      = "alias/eazepay/dev/logs"
  key_admins = []
  key_users  = []
}

# ----- Audit / flow-log bucket -----
module "flow_logs_bucket" {
  source             = "../../modules/s3-bucket"
  name               = "eazepay-dev-flow-logs"
  kms_key_arn        = module.kms_logs.key_arn
  lifecycle_expire_after_days = 90
}

# ----- Documents bucket (compliance docs / KYC images) -----
module "documents_bucket" {
  source                = "../../modules/s3-bucket"
  name                  = "eazepay-dev-compliance-docs"
  kms_key_arn           = module.kms_documents.key_arn
  object_lock_enabled   = true
  object_lock_default_retention_days = 1825 # 5 years; per-record retentionUntil overrides
}

# ----- Audit-archive bucket (S3 Object Lock) -----
module "audit_archive_bucket" {
  source                = "../../modules/s3-bucket"
  name                  = "eazepay-dev-audit-archive"
  kms_key_arn           = module.kms_logs.key_arn
  object_lock_enabled   = true
  object_lock_default_retention_days = 2555 # ~7 years
}

# ----- Network -----
module "network" {
  source              = "../../modules/network"
  name                = "eazepay-dev"
  cidr_block          = "10.20.0.0/16"
  azs                 = var.azs
  flow_log_bucket_arn = module.flow_logs_bucket.bucket_arn
}

# Compose Aurora + Redis + ECS in env-specific files for readability.
# secrets.tf, aurora.tf, ecs.tf land alongside this main.tf when each
# is wired with real account ids.
