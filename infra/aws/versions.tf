/**
 * versions.tf
 *
 * Pins Terraform CLI + provider versions so every operator runs the same
 * graph. Drift on provider versions is a security incident waiting to
 * happen (resource schemas can change, IAM policies can re-render).
 *
 * S3 backend block is INTENTIONALLY COMMENTED until the tfstate bucket
 * exists. Bootstrap procedure in README.md walks through the
 * chicken-and-egg sequence: local state -> create tfstate bucket ->
 * uncomment + `terraform init -migrate-state`.
 */
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # backend "s3" {
  #   bucket         = "eazepay-tfstate-<account-id>"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   kms_key_id     = "alias/aws/s3" # bootstrap uses AWS-managed; later switch to alias/eazepay-data-prod
  #   dynamodb_table = "eazepay-tfstate-lock"
  # }
}
