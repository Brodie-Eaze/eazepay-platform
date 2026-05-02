/**
 * ElastiCache Redis (cluster mode disabled, multi-AZ replica). Used
 * by apps/api for sessions, idempotency keys, OTP storage, and
 * short-TTL caches. Encrypted at rest + in transit.
 */
terraform {
  required_version = ">= 1.6.0"
  required_providers { aws = { source = "hashicorp/aws", version = ">= 5.0" } }
}

variable "name"             { type = string }
variable "subnet_ids"       { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "node_type"        { type = string, default = "cache.t4g.medium" }
variable "replicas"         { type = number, default = 1 }
variable "kms_key_arn"      { type = string }
variable "auth_secret_arn"  { type = string }
variable "tags"             { type = map(string), default = {} }

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-redis"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

data "aws_secretsmanager_secret_version" "auth" {
  secret_id = var.auth_secret_arn
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id        = "${var.name}-redis"
  description                 = "${var.name} Redis (sessions/idempotency/otp)"
  engine                      = "redis"
  engine_version              = "7.1"
  node_type                   = var.node_type
  parameter_group_name        = "default.redis7"
  num_cache_clusters          = 1 + var.replicas
  port                        = 6379
  automatic_failover_enabled  = true
  multi_az_enabled            = true
  subnet_group_name           = aws_elasticache_subnet_group.this.name
  security_group_ids          = var.security_group_ids
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  kms_key_id                  = var.kms_key_arn
  auth_token                  = data.aws_secretsmanager_secret_version.auth.secret_string
  snapshot_retention_limit    = 7
  tags                        = var.tags
}

output "primary_endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
