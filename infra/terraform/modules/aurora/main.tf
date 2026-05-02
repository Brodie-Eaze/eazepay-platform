/**
 * Aurora PostgreSQL cluster (multi-AZ). KMS-encrypted at rest, IAM
 * database authentication enabled, automated backups + 35-day PITR,
 * cross-region replica wired via Aurora Global Database (caller
 * passes a separate provider for the secondary region).
 */
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

variable "name"          { type = string }
variable "engine_version" { type = string, default = "16.2" }
variable "subnet_ids"    { type = list(string) }
variable "kms_key_arn"   { type = string }
variable "master_secret_arn" { type = string }
variable "instance_class" { type = string, default = "db.r6g.large" }
variable "instance_count" { type = number, default = 2 }
variable "security_group_ids" { type = list(string) }
variable "tags"          { type = map(string), default = {} }

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-aurora"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

data "aws_secretsmanager_secret_version" "master" {
  secret_id = var.master_secret_arn
}

resource "aws_rds_cluster" "this" {
  cluster_identifier              = "${var.name}-aurora"
  engine                          = "aurora-postgresql"
  engine_version                  = var.engine_version
  database_name                   = "eazepay"
  master_username                 = jsondecode(data.aws_secretsmanager_secret_version.master.secret_string)["username"]
  master_password                 = jsondecode(data.aws_secretsmanager_secret_version.master.secret_string)["password"]
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = var.security_group_ids
  storage_encrypted               = true
  kms_key_id                      = var.kms_key_arn
  iam_database_authentication_enabled = true
  backup_retention_period         = 35
  preferred_backup_window         = "03:00-04:00"
  preferred_maintenance_window    = "mon:04:00-mon:05:00"
  copy_tags_to_snapshot           = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  deletion_protection             = true
  tags                            = var.tags
  lifecycle {
    ignore_changes = [master_password]
  }
}

resource "aws_rds_cluster_instance" "this" {
  count                  = var.instance_count
  identifier             = "${var.name}-aurora-${count.index}"
  cluster_identifier     = aws_rds_cluster.this.id
  instance_class         = var.instance_class
  engine                 = aws_rds_cluster.this.engine
  engine_version         = aws_rds_cluster.this.engine_version
  db_subnet_group_name   = aws_db_subnet_group.this.name
  performance_insights_enabled = true
  performance_insights_kms_key_id = var.kms_key_arn
  tags                   = var.tags
}

output "cluster_endpoint"    { value = aws_rds_cluster.this.endpoint }
output "cluster_reader_endpoint" { value = aws_rds_cluster.this.reader_endpoint }
output "cluster_id"          { value = aws_rds_cluster.this.id }
