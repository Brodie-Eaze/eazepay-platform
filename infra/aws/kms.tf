/**
 * kms.tf
 *
 * Two customer-managed KMS keys:
 *
 *   1. KEK ("alias/eazepay-kek-prod")  — envelope encryption.
 *      App generates per-record DEKs (data encryption keys),
 *      encrypts the DEK with this KEK via kms:GenerateDataKey,
 *      stores the wrapped DEK alongside the ciphertext. Only the
 *      payment + audit services hold kms:Decrypt on the KEK.
 *
 *   2. Data key ("alias/eazepay-data-prod") — at-rest encryption
 *      for RDS, ElastiCache, S3, CloudWatch logs, Secrets Manager.
 *      AWS-managed encryption flows go through this single key so
 *      revocation is one knob.
 *
 * Both keys have rotation enabled (annual, AWS-managed). Deletion
 * window is 30 days (max) — gives us time to recover from an
 * accidental schedule_key_deletion.
 *
 * Policy: account root holds admin, IAM principals get use rights
 * via grants/policy. The "via service" condition restricts decrypt
 * to AWS services that legitimately need it (e.g. S3, RDS).
 */

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

# ----- KEK — application envelope encryption -----
resource "aws_kms_key" "kek" {
  description             = "eazepay ${var.environment} — Key Encryption Key for envelope-encrypted PII (payment + audit services)"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  key_usage               = "ENCRYPT_DECRYPT"
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccountAdmin"
        Effect = "Allow"
        Principal = {
          AWS = "arn:${data.aws_partition.current.partition}:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchLogsEncrypt"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${var.aws_account_id}:log-group:*"
          }
        }
      }
    ]
  })

  tags = {
    Name    = "eazepay-${var.environment}-kek"
    Purpose = "envelope-encryption"
  }
}

resource "aws_kms_alias" "kek" {
  name          = "alias/eazepay-kek-${var.environment}"
  target_key_id = aws_kms_key.kek.key_id
}

# ----- Data key — RDS, S3, CloudWatch, Secrets Manager at-rest -----
resource "aws_kms_key" "data" {
  description             = "eazepay ${var.environment} — at-rest encryption for RDS, ElastiCache, S3, CloudWatch logs, Secrets Manager"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  key_usage               = "ENCRYPT_DECRYPT"
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccountAdmin"
        Effect = "Allow"
        Principal = {
          AWS = "arn:${data.aws_partition.current.partition}:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowAWSServicesViaCondition"
        Effect = "Allow"
        Principal = {
          AWS = "arn:${data.aws_partition.current.partition}:iam::${var.aws_account_id}:root"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:CallerAccount" = var.aws_account_id
          }
          StringLike = {
            "kms:ViaService" = [
              "s3.${var.aws_region}.amazonaws.com",
              "rds.${var.aws_region}.amazonaws.com",
              "elasticache.${var.aws_region}.amazonaws.com",
              "secretsmanager.${var.aws_region}.amazonaws.com",
              "logs.${var.aws_region}.amazonaws.com"
            ]
          }
        }
      }
    ]
  })

  tags = {
    Name    = "eazepay-${var.environment}-data"
    Purpose = "at-rest-encryption"
  }
}

resource "aws_kms_alias" "data" {
  name          = "alias/eazepay-data-${var.environment}"
  target_key_id = aws_kms_key.data.key_id
}

output "kek_key_arn" {
  value       = aws_kms_key.kek.arn
  description = "KEK ARN — payment/audit task roles get kms:Decrypt on this."
}

output "data_key_arn" {
  value       = aws_kms_key.data.arn
  description = "Data key ARN — RDS, S3, ElastiCache encrypted with this."
}
