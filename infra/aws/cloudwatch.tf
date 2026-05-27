/**
 * cloudwatch.tf
 *
 * Log group per service. Retention = 90 days (audit-grade events go
 * to S3 Object Lock separately; CloudWatch is for ops/debug visibility).
 *
 * All log groups encrypted with data KMS key. Naming pattern:
 *   /eazepay/<env>/<service>
 *
 * SNS topic + cost-anomaly alarm wired here — operator subscribes
 * email after first apply.
 */

resource "aws_cloudwatch_log_group" "service" {
  for_each = var.services

  name              = "/eazepay/${var.environment}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.data.arn

  tags = {
    Name    = "eazepay-${var.environment}-logs-${each.key}"
    Service = each.key
  }
}

# Ops alerting topic. Operator subscribes phone/email after first apply
# (subscriptions managed out-of-band so they survive stack destroy).
resource "aws_sns_topic" "ops_alerts" {
  name              = "eazepay-${var.environment}-ops-alerts"
  kms_master_key_id = aws_kms_key.data.arn

  tags = {
    Name = "eazepay-${var.environment}-ops-alerts"
  }
}

# Billing alarm — fires when estimated charges exceed threshold.
# us-east-1 is the ONLY region that has CloudWatch billing metrics.
resource "aws_cloudwatch_metric_alarm" "billing" {
  alarm_name          = "eazepay-${var.environment}-billing-exceeded"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 21600 # 6h
  statistic           = "Maximum"
  threshold           = 500 # USD; tune up as we scale
  treat_missing_data  = "notBreaching"
  alarm_description   = "Total estimated monthly charges exceed $500 — investigate via Cost Explorer."

  dimensions = {
    Currency = "USD"
  }

  alarm_actions = [aws_sns_topic.ops_alerts.arn]

  tags = {
    Name = "eazepay-${var.environment}-billing-alarm"
  }
}

# Per-service CPU high alarm — fires when a service sustains > 80% CPU
# (indicates need to scale or investigate a hot path).
resource "aws_cloudwatch_metric_alarm" "service_cpu_high" {
  for_each = var.services

  alarm_name          = "eazepay-${var.environment}-${each.key}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "${each.key} sustained CPU > 80% for 15 minutes."

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.service[each.key].name
  }

  alarm_actions = [aws_sns_topic.ops_alerts.arn]
  ok_actions    = [aws_sns_topic.ops_alerts.arn]

  tags = {
    Name    = "eazepay-${var.environment}-cpu-alarm-${each.key}"
    Service = each.key
  }
}

# ALB 5xx alarm — any sustained 5xx is a problem.
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "eazepay-${var.environment}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  alarm_description   = "ALB target group is returning > 10 5xx responses per minute."

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.ops_alerts.arn]

  tags = {
    Name = "eazepay-${var.environment}-alb-5xx-alarm"
  }
}

# RDS CPU alarm.
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "eazepay-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "RDS sustained CPU > 75% for 15 minutes — consider scale up."

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  alarm_actions = [aws_sns_topic.ops_alerts.arn]

  tags = {
    Name = "eazepay-${var.environment}-rds-cpu-alarm"
  }
}

# RDS free storage alarm.
resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "eazepay-${var.environment}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10 GiB in bytes
  alarm_description   = "RDS free storage < 10 GiB. Storage autoscaling should kick in; verify."

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  alarm_actions = [aws_sns_topic.ops_alerts.arn]

  tags = {
    Name = "eazepay-${var.environment}-rds-storage-alarm"
  }
}

output "ops_alerts_topic_arn" {
  value       = aws_sns_topic.ops_alerts.arn
  description = "SNS topic for ops alerts. Operator subscribes email/SMS via AWS Console after first apply."
}
