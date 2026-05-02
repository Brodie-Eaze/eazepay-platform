/**
 * Encrypted private bucket. Optional Object Lock for write-once
 * retention (audit-archive, document store). Default-deny public
 * access; KMS SSE always on; versioning enabled.
 */
terraform {
  required_version = ">= 1.6.0"
  required_providers { aws = { source = "hashicorp/aws", version = ">= 5.0" } }
}

variable "name"             { type = string }
variable "kms_key_arn"      { type = string }
variable "object_lock_enabled" { type = bool, default = false }
variable "object_lock_default_retention_days" { type = number, default = 0 }
variable "lifecycle_expire_after_days" { type = number, default = 0 }
variable "tags"             { type = map(string), default = {} }

resource "aws_s3_bucket" "this" {
  bucket              = var.name
  object_lock_enabled = var.object_lock_enabled
  tags                = var.tags
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object_lock_configuration" "this" {
  count  = var.object_lock_enabled && var.object_lock_default_retention_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.this.id
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.object_lock_default_retention_days
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  count  = var.lifecycle_expire_after_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.this.id
  rule {
    id     = "auto-expire"
    status = "Enabled"
    expiration { days = var.lifecycle_expire_after_days }
    noncurrent_version_expiration { noncurrent_days = max(30, var.lifecycle_expire_after_days) }
  }
}

output "bucket_name" { value = aws_s3_bucket.this.id }
output "bucket_arn"  { value = aws_s3_bucket.this.arn }
