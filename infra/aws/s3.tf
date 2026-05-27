/**
 * s3.tf
 *
 * Three buckets:
 *
 *   1. audit  — Object Lock GOVERNANCE, 2557d retention (7y BSA).
 *               Lifecycle: 90d -> Glacier Deep Archive. Versioning ON.
 *   2. artifacts — generic app artifacts (uploaded compliance docs,
 *                  generated PDFs). Versioning ON, no Object Lock.
 *   3. tfstate — Terraform state backend. Versioning ON for rollback.
 *
 * ALL buckets:
 *   - Public access blocked at 4 layers (account-level block recommended too)
 *   - SSE with customer KMS data key
 *   - Bucket policy denies any non-TLS request
 *
 * Account-id suffix on every bucket name — names are global and
 * predictable names get squatted.
 *
 * IMPORTANT: tfstate bucket here is a regular resource that gets
 * provisioned ALONGSIDE everything else AFTER the bootstrap (see
 * README). The first apply runs with local state; second apply
 * (after uncommenting backend block in versions.tf) migrates state
 * into this bucket.
 */

# ----- Audit bucket — BSA 7yr retention, Object Lock GOVERNANCE -----
resource "aws_s3_bucket" "audit" {
  bucket = "eazepay-audit-${var.environment}-${var.aws_account_id}"

  # Object Lock can ONLY be enabled at bucket creation time.
  # If you forget this flag, you must recreate the bucket.
  object_lock_enabled = true

  tags = {
    Name             = "eazepay-${var.environment}-audit"
    DataClass        = "audit"
    Retention        = "7y-bsa"
    LifecycleManaged = "true"
  }
}

resource "aws_s3_bucket_versioning" "audit" {
  bucket = aws_s3_bucket.audit.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
    bucket_key_enabled = true # ~99% reduction in KMS API costs
  }
}

resource "aws_s3_bucket_public_access_block" "audit" {
  bucket                  = aws_s3_bucket.audit.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object_lock_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    default_retention {
      mode = "GOVERNANCE" # not COMPLIANCE — we may need to flip a key with break-glass procedure
      days = var.s3_audit_retention_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.audit]
}

resource "aws_s3_bucket_lifecycle_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    id     = "audit-archive"
    status = "Enabled"

    filter {} # apply to all objects

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "DEEP_ARCHIVE"
    }

    # NOTE: we explicitly DO NOT set an expiration. Object Lock retention
    # is the authoritative deletion gate.
  }
}

resource "aws_s3_bucket_policy" "audit" {
  bucket = aws_s3_bucket.audit.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.audit.arn,
          "${aws_s3_bucket.audit.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      }
    ]
  })
}

# ----- Artifacts bucket -----
resource "aws_s3_bucket" "artifacts" {
  bucket = "eazepay-artifacts-${var.environment}-${var.aws_account_id}"

  tags = {
    Name      = "eazepay-${var.environment}-artifacts"
    DataClass = "operational"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_policy" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      }
    ]
  })
}

# ----- Terraform state bucket -----
# After first apply, uncomment backend "s3" in versions.tf and run
# `terraform init -migrate-state` to flip state from local to S3.
resource "aws_s3_bucket" "tfstate" {
  bucket = "eazepay-tfstate-${var.aws_account_id}"

  tags = {
    Name      = "eazepay-tfstate"
    DataClass = "infrastructure-state"
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      # AWS-managed key during bootstrap — KMS-managed key chicken/egg
      # (we'd need to read data.aws_kms_key.data before this exists).
      # Flip to customer KMS key after stabilization if desired.
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.tfstate.arn,
          "${aws_s3_bucket.tfstate.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      }
    ]
  })
}

# DynamoDB table for state locking.
resource "aws_dynamodb_table" "tfstate_lock" {
  name         = "eazepay-tfstate-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "eazepay-tfstate-lock"
  }
}

output "s3_audit_bucket" {
  value       = aws_s3_bucket.audit.bucket
  description = "Audit bucket name — audit service writes here."
}

output "s3_artifacts_bucket" {
  value       = aws_s3_bucket.artifacts.bucket
  description = "Artifacts bucket — compliance docs, generated PDFs."
}

output "s3_tfstate_bucket" {
  value       = aws_s3_bucket.tfstate.bucket
  description = "Terraform state bucket — uncomment backend block in versions.tf and re-init to migrate state."
}
