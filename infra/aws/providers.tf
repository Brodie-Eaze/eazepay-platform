/**
 * providers.tf
 *
 * Single AWS provider for prod. Default tags propagate to every
 * resource that supports tagging, so cost allocation + ownership
 * queries work out of the box (no per-resource tag block needed
 * unless we want to override or add).
 *
 * NOTE: a second provider alias would be needed for resources that
 * MUST live in us-east-1 (ACM cert for CloudFront, WAFv2 CLOUDFRONT
 * scope). Today we're already in us-east-1, so no alias required.
 */
provider "aws" {
  region = var.aws_region

  # Defense-in-depth: refuse to run against the wrong account.
  # Prevents an operator with multiple AWS profiles from clobbering
  # the wrong environment.
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = {
      Project    = "eazepay"
      Env        = var.environment
      ManagedBy  = "terraform"
      Repo       = "eaze-billing"
      CostCenter = "platform"
      Owner      = "brodie@amalafinance.com.au"
    }
  }
}
