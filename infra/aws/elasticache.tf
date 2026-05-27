/**
 * elasticache.tf
 *
 * Redis 7 for sessions, rate-limit counters, idempotency keys,
 * pubsub for Pusher backfill.
 *
 * V1 SHAPE: single-node replication group (no shards, no replicas).
 *   - cache.t4g.micro = $0.016/hr (~$12/mo)
 *   - Encryption in-transit + at-rest with data KMS key
 *   - Auth token stored in Secrets Manager
 *
 * SCALE WARNING — flip to multi-node BEFORE production traffic:
 *   replicas_per_node_group >= 1, num_node_groups >= 1, automatic_failover_enabled = true
 *   Today's config has NO failover — an AZ outage takes Redis offline,
 *   which takes sessions offline. Acceptable during migration cutover
 *   window, NOT acceptable steady-state.
 */

resource "random_password" "redis_auth" {
  length = 64
  # Redis AUTH token only allows printable ASCII; no special chars.
  special = false
}

resource "aws_secretsmanager_secret" "redis_auth" {
  name        = "/${var.environment}/eazepay/redis/auth-token"
  description = "Redis AUTH token. Used to construct REDIS_URL with rediss:// scheme."
  kms_key_id  = aws_kms_key.data.arn

  recovery_window_in_days = 30

  tags = {
    Name      = "eazepay-${var.environment}-redis-auth"
    DataClass = "secret"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.redis_auth.result

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name        = "eazepay-${var.environment}-redis"
  description = "Private subnets for ElastiCache Redis."
  subnet_ids  = [for s in aws_subnet.private : s.id]

  tags = {
    Name = "eazepay-${var.environment}-redis-subnet-group"
  }
}

resource "aws_elasticache_parameter_group" "redis" {
  name        = "eazepay-${var.environment}-redis7"
  family      = "redis7"
  description = "Redis 7.x — defaults are sane; placeholder for future tuning."

  tags = {
    Name = "eazepay-${var.environment}-redis7"
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "eazepay-${var.environment}"
  description          = "Sessions, rate limits, idempotency keys, pubsub."

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_clusters   = 1 # SCALE: bump to 2+ for HA, and set automatic_failover_enabled = true
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption.
  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.data.arn
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  # No failover at single-node — flag here for clarity.
  automatic_failover_enabled = false
  multi_az_enabled           = false

  # Backups.
  snapshot_retention_limit = 7
  snapshot_window          = "03:00-04:00"
  maintenance_window       = "sun:04:00-sun:05:00"

  # Apply changes during maintenance window unless overridden.
  apply_immediately = false

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = {
    Name = "eazepay-${var.environment}-redis"
  }

  lifecycle {
    ignore_changes = [auth_token]
  }
}

resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/eazepay-${var.environment}/slow-log"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.data.arn

  tags = {
    Name    = "eazepay-${var.environment}-redis-slow"
    Service = "redis"
  }
}

resource "aws_cloudwatch_log_group" "redis_engine" {
  name              = "/aws/elasticache/eazepay-${var.environment}/engine-log"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.data.arn

  tags = {
    Name    = "eazepay-${var.environment}-redis-engine"
    Service = "redis"
  }
}

output "redis_primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Redis primary endpoint. Operator constructs REDIS_URL = rediss://:<auth>@<endpoint>:6379 manually."
}

output "redis_auth_secret_arn" {
  value       = aws_secretsmanager_secret.redis_auth.arn
  description = "Redis AUTH token secret. Used to construct REDIS_URL."
  sensitive   = true
}
