/**
 * ecs_cluster.tf
 *
 * Single ECS Fargate cluster — all services share it. Cluster is
 * essentially a namespace; cost is the underlying Fargate tasks.
 *
 * Container Insights ON for per-task CPU/memory metrics in
 * CloudWatch (small extra cost, big observability win).
 *
 * Capacity providers: FARGATE for steady-state, FARGATE_SPOT
 * available but NOT set as default (Spot reclamation kills tasks
 * with 2-min warning — fine for batch, NOT fine for payment APIs).
 * Per-service capacity_provider_strategy can opt in to Spot where
 * appropriate.
 */

resource "aws_ecs_cluster" "main" {
  name = "eazepay-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      kms_key_id = aws_kms_key.data.arn
      logging    = "OVERRIDE"
      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  tags = {
    Name = "eazepay-${var.environment}-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# Log group for `ecs execute-command` sessions (kubectl exec equivalent).
# Critical for incident response — every exec into a task is logged.
resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/eazepay/${var.environment}/ecs-exec"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.data.arn

  tags = {
    Name    = "eazepay-${var.environment}-ecs-exec"
    Service = "ecs-exec"
  }
}

output "ecs_cluster_arn" {
  value       = aws_ecs_cluster.main.arn
  description = "ECS cluster ARN."
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name."
}
