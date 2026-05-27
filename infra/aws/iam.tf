/**
 * iam.tf
 *
 * Two role types per service:
 *
 *   1. Task EXECUTION role — assumed by ECS agent (not the app).
 *      Used to pull images from ECR, write to CloudWatch, fetch
 *      secrets to inject into the container env at boot.
 *      We use ONE shared execution role across all services (this
 *      is the standard pattern; ECS docs encourage it).
 *
 *   2. Task ROLE — assumed by the app container. Per-service so
 *      audit service can't decrypt with the KEK, payment service
 *      can't write to the artifacts bucket as audit, etc.
 *
 * Trust policy: ecs-tasks.amazonaws.com only. No human users.
 * No long-lived access keys. No wildcards on resources.
 *
 * The per-service permission map (local.service_permissions) is
 * declarative — adding "s3:GetObject on artifacts bucket" to the
 * compliance-doc service is one line.
 */

# ----- Shared task execution role -----
resource "aws_iam_role" "ecs_task_execution" {
  name = "eazepay-${var.environment}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = var.aws_account_id
        }
        ArnLike = {
          "aws:SourceArn" = "arn:${data.aws_partition.current.partition}:ecs:${var.aws_region}:${var.aws_account_id}:*"
        }
      }
    }]
  })

  tags = {
    Name = "eazepay-${var.environment}-ecs-task-execution"
  }
}

# AWS-managed policy for the basics (ECR pull, CW logs).
resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Extra inline policy for: reading secrets from Secrets Manager
# (so ECS can inject them as env vars at task boot) + decrypting
# with the data KMS key.
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "secrets-and-kms"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadAppSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = concat(
          [for s in aws_secretsmanager_secret.app : s.arn],
          [aws_secretsmanager_secret.rds_master.arn, aws_secretsmanager_secret.redis_auth.arn],
        )
      },
      {
        Sid    = "DecryptDataKey"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.data.arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# ----- Per-service task roles -----
# Trust policy is identical across services — only the permissions differ.
locals {
  ecs_task_assume_role = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = var.aws_account_id
        }
      }
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  for_each = var.services

  name               = "eazepay-${var.environment}-task-${each.key}"
  assume_role_policy = local.ecs_task_assume_role

  tags = {
    Name    = "eazepay-${var.environment}-task-${each.key}"
    Service = each.key
  }
}

# Baseline permissions every service gets: write its own logs, get
# its own service token (for SDKs that fetch task metadata).
resource "aws_iam_role_policy" "task_baseline" {
  for_each = var.services

  name = "baseline"
  role = aws_iam_role.ecs_task[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "WriteOwnLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${var.aws_account_id}:log-group:/eazepay/${var.environment}/${each.key}:*"
      },
      {
        Sid      = "XRayWrite"
        Effect   = "Allow"
        Action   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
        Resource = "*"
      }
    ]
  })
}

# ----- Per-service specific permissions -----
# Declarative map: service name -> JSON statement list. Only services
# that NEED non-baseline permissions appear here.

# Audit service: write to audit bucket ONLY (append-only via Object Lock).
resource "aws_iam_role_policy" "task_audit" {
  name = "audit-bucket-write"
  role = aws_iam_role.ecs_task["audit"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "WriteAuditObjects"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:PutObjectRetention", # required to set per-object lock retention
          "s3:GetObject",          # read-back for verification
          "s3:GetObjectRetention"
        ]
        Resource = "${aws_s3_bucket.audit.arn}/*"
      },
      {
        Sid      = "ListAuditBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation"]
        Resource = aws_s3_bucket.audit.arn
      },
      {
        Sid    = "EncryptAuditPutsViaKMS"
        Effect = "Allow"
        Action = [
          "kms:GenerateDataKey",
          "kms:Encrypt",
          "kms:Decrypt", # read-back
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.data.arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "s3.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Payment service: KEK decrypt (envelope encryption of stored
# tokenized card refs / bank account refs).
resource "aws_iam_role_policy" "task_payment" {
  name = "kek-encrypt-decrypt"
  role = aws_iam_role.ecs_task["payment"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnvelopeEncryption"
        Effect = "Allow"
        Action = [
          "kms:GenerateDataKey",
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.kek.arn
      }
    ]
  })
}

# Compliance-doc service: read/write artifacts bucket (uploaded docs).
resource "aws_iam_role_policy" "task_compliance_doc" {
  name = "artifacts-bucket-rw"
  role = aws_iam_role.ecs_task["compliance-doc"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadWriteArtifactObjects"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.artifacts.arn}/compliance/*"
      },
      {
        Sid      = "ListArtifactsBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation"]
        Resource = aws_s3_bucket.artifacts.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["compliance/*", "compliance"]
          }
        }
      },
      {
        Sid    = "ArtifactsKMS"
        Effect = "Allow"
        Action = [
          "kms:GenerateDataKey",
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.data.arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "s3.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Partner-portal: read-only artifacts (to serve generated PDFs back
# to merchants via signed URLs).
resource "aws_iam_role_policy" "task_partner_portal" {
  name = "artifacts-bucket-readonly"
  role = aws_iam_role.ecs_task["partner-portal"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadArtifactObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.artifacts.arn}/*"
      },
      {
        Sid      = "ListArtifactsBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.artifacts.arn
      },
      {
        Sid    = "DecryptForRead"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.data.arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "s3.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

output "ecs_task_execution_role_arn" {
  value       = aws_iam_role.ecs_task_execution.arn
  description = "Shared ECS task execution role ARN."
}

output "ecs_task_role_arns" {
  value       = { for k, r in aws_iam_role.ecs_task : k => r.arn }
  description = "Per-service ECS task role ARNs."
}
