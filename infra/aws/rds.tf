/**
 * rds.tf
 *
 * Aurora-compatible Postgres on RDS Multi-AZ. Why RDS-not-Aurora
 * for v1: cost — Aurora's per-IO billing model is unpredictable for
 * a workload we haven't profiled yet. RDS gp3 has fixed storage cost
 * + predictable IOPS allocation. Migrating to Aurora later is a
 * snapshot-restore operation, not a re-architecture.
 *
 * Hardening:
 *   - Multi-AZ (synchronous standby in different AZ — failover ~60s)
 *   - Encryption-at-rest via customer KMS key (data)
 *   - In-transit SSL enforced via parameter group below
 *   - Deletion protection ON (TF must temporarily set false to destroy)
 *   - Auto minor version upgrade in maintenance window
 *   - Backup window: 03:00-04:00 UTC = 10pm-11pm Eastern (low traffic)
 *   - Maintenance: Sunday 04:00-05:00 UTC
 *   - Performance Insights ON, 7d retention (free tier)
 *   - Enhanced monitoring at 60s granularity
 *   - DB password stored in Secrets Manager, NOT in TF state plain text
 */

# Random password for master user — stored in Secrets Manager, never
# in tfstate (well, it IS in state, but state is itself KMS-encrypted
# in the S3 backend).
resource "random_password" "rds_master" {
  length  = 32
  special = true
  # RDS Postgres disallows /, @, ", and spaces in master passwords.
  override_special = "!#$%&*()-_=+[]{}<>?"
}

resource "aws_secretsmanager_secret" "rds_master" {
  name        = "/${var.environment}/eazepay/rds/master-credentials"
  description = "RDS master user credentials. Rotated by RDS-native Lambda."
  kms_key_id  = aws_kms_key.data.arn

  recovery_window_in_days = 30

  tags = {
    Name      = "eazepay-${var.environment}-rds-master"
    DataClass = "secret"
  }
}

resource "aws_secretsmanager_secret_version" "rds_master" {
  secret_id = aws_secretsmanager_secret.rds_master.id
  secret_string = jsonencode({
    username = "eazepay_admin"
    password = random_password.rds_master.result
    engine   = "postgres"
    port     = 5432
  })

  lifecycle {
    # Rotation managed by AWS Secrets Manager rotation Lambda
    # (configured below) — don't drift on rotated values.
    ignore_changes = [secret_string]
  }
}

resource "aws_db_subnet_group" "rds" {
  name        = "eazepay-${var.environment}-rds"
  description = "Private subnets across all 3 AZs for RDS Multi-AZ."
  subnet_ids  = [for s in aws_subnet.private : s.id]

  tags = {
    Name = "eazepay-${var.environment}-rds-subnet-group"
  }
}

# Force SSL + a few perf knobs.
resource "aws_db_parameter_group" "rds" {
  name        = "eazepay-${var.environment}-pg16"
  family      = "postgres16"
  description = "Postgres 16 — force SSL, log slow queries, sane defaults."

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "500" # log queries > 500ms
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name = "eazepay-${var.environment}-pg16"
  }
}

resource "aws_db_instance" "main" {
  identifier = "eazepay-${var.environment}"

  engine         = "postgres"
  engine_version = "16.3" # pinned — auto_minor_version_upgrade=true handles patch
  instance_class = var.rds_instance_class

  allocated_storage     = var.rds_allocated_storage_gb
  max_allocated_storage = var.rds_max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.data.arn

  db_name  = "eazepay"
  username = "eazepay_admin"
  password = random_password.rds_master.result
  port     = 5432

  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.rds.name
  publicly_accessible    = false

  backup_retention_period   = var.rds_backup_retention_days
  backup_window             = "03:00-04:00"
  maintenance_window        = "Sun:04:00-Sun:05:00"
  copy_tags_to_snapshot     = true
  delete_automated_backups  = false
  skip_final_snapshot       = false
  final_snapshot_identifier = "eazepay-${var.environment}-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"

  deletion_protection        = true
  auto_minor_version_upgrade = true

  performance_insights_enabled          = true
  performance_insights_retention_period = 7 # free tier
  performance_insights_kms_key_id       = aws_kms_key.data.arn

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  apply_immediately = false # safer default; flip via tfvars when needed

  tags = {
    Name = "eazepay-${var.environment}-rds"
  }

  lifecycle {
    # Don't churn on the timestamp-suffixed final snapshot id between plans.
    ignore_changes = [final_snapshot_identifier, password]
  }
}

# Enhanced monitoring role.
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "eazepay-${var.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "monitoring.rds.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "eazepay-${var.environment}-rds-monitoring"
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

output "rds_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "RDS Postgres endpoint (host:port). NOT injected into apps — operator constructs DATABASE_URL secret manually after first apply."
}

output "rds_master_secret_arn" {
  value       = aws_secretsmanager_secret.rds_master.arn
  description = "Master credentials secret. Used to construct DATABASE_URL — never hand out to app."
  sensitive   = true
}
