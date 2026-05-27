/**
 * alb.tf
 *
 * Public Application Load Balancer in public subnets. HTTPS 443
 * listener with ACM cert; HTTP 80 redirects to 443.
 *
 * Path-based routing into the partner-portal as the primary app.
 * Internal services have target groups (so ECS health checks work)
 * but are NOT attached to any listener rule — only the partner-portal
 * is publicly addressable from the internet. Internal services are
 * reached via the ECS task SG over the VPC.
 *
 * ACM cert is a DATA SOURCE — managed separately so re-issuance
 * doesn't churn the listener resource.
 *
 * SCALE NOTE: ALB access logs go to artifacts bucket; flip to a
 * dedicated logs bucket if volume justifies it.
 */

# Look up the ACM cert by domain. The cert MUST be ISSUED and in this
# region before first apply. See README for one-shot creation via CLI.
data "aws_acm_certificate" "wildcard" {
  domain      = var.acm_certificate_domain
  statuses    = ["ISSUED"]
  most_recent = true
}

resource "aws_lb" "main" {
  name               = "eazepay-${var.environment}"
  load_balancer_type = "application"
  internal           = false

  subnets         = [for s in aws_subnet.public : s.id]
  security_groups = [aws_security_group.alb.id]

  enable_deletion_protection = true
  enable_http2               = true
  drop_invalid_header_fields = true # mitigates header smuggling
  idle_timeout               = 60

  access_logs {
    bucket  = aws_s3_bucket.artifacts.id
    prefix  = "alb/eazepay-${var.environment}"
    enabled = true
  }

  tags = {
    Name = "eazepay-${var.environment}-alb"
  }
}

# Bucket policy fragment for ALB access log writes.
# ALB log delivery uses a regional AWS account principal (not a service principal).
data "aws_elb_service_account" "main" {}

resource "aws_s3_bucket_policy" "artifacts_alb_logs" {
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
      },
      {
        Sid    = "ALBLogDelivery"
        Effect = "Allow"
        Principal = {
          AWS = data.aws_elb_service_account.main.arn
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.artifacts.arn}/alb/eazepay-${var.environment}/AWSLogs/${var.aws_account_id}/*"
      },
      {
        Sid    = "ALBLogDeliveryWrite"
        Effect = "Allow"
        Principal = {
          Service = "logdelivery.elasticloadbalancing.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.artifacts.arn}/alb/eazepay-${var.environment}/AWSLogs/${var.aws_account_id}/*"
      }
    ]
  })

  # Override the basic artifacts policy in s3.tf (Terraform picks the
  # last applied; same resource, so this replaces).
  depends_on = [aws_s3_bucket.artifacts]
}

# ----- Target groups (one per service) -----
resource "aws_lb_target_group" "service" {
  for_each = var.services

  name        = "eazepay-${var.environment}-${substr(each.key, 0, 20)}"
  port        = each.value.container_port
  protocol    = "HTTP"
  target_type = "ip" # required for Fargate
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = each.value.health_check_path
    protocol            = "HTTP"
    matcher             = "200-299"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = {
    Name    = "eazepay-${var.environment}-tg-${each.key}"
    Service = each.key
  }
}

# ----- Listeners -----

# HTTP listener — redirect 301 to HTTPS.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = {
    Name = "eazepay-${var.environment}-listener-http"
  }
}

# HTTPS listener. Default action returns 404 — explicit listener
# rules below route only the public-facing services.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = data.aws_acm_certificate.wildcard.arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }

  tags = {
    Name = "eazepay-${var.environment}-listener-https"
  }
}

# Listener rules: only for services with public=true.
resource "aws_lb_listener_rule" "service" {
  for_each = { for k, v in var.services : k => v if v.public }

  listener_arn = aws_lb_listener.https.arn
  priority     = each.value.priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service[each.key].arn
  }

  condition {
    path_pattern {
      values = [each.value.path_pattern]
    }
  }

  tags = {
    Name    = "eazepay-${var.environment}-rule-${each.key}"
    Service = each.key
  }
}

output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "ALB DNS name. Route53 record (in route53.tf) aliases app.<domain> here at cutover."
}

output "alb_zone_id" {
  value       = aws_lb.main.zone_id
  description = "ALB hosted zone ID — used by Route53 alias records."
}
