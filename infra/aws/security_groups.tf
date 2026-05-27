/**
 * security_groups.tf
 *
 * Default-deny. Every SG rule is an explicit allow with a narrow
 * source (SG ref, not CIDR — so adding a new ECS service automatically
 * picks up RDS access without editing SG rules).
 *
 * Trust chain:
 *   internet -> ALB SG (443 in)
 *   ALB SG  -> ECS task SG (variable container port)
 *   ECS SG  -> RDS SG (5432)
 *   ECS SG  -> Redis SG (6379)
 *   ECS SG  -> 443 OUT (to AWS APIs via NAT/VPCE)
 *
 * Egress is closed by default; we explicitly allow 443 out from ECS
 * tasks (AWS API calls + Stripe + Resend + Pusher all over HTTPS).
 * If a service needs another port out, add a rule.
 */

# ----- ALB -----
resource "aws_security_group" "alb" {
  name        = "eazepay-${var.environment}-alb"
  description = "Public ALB. Accepts 443 from the internet."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "eazepay-${var.environment}-alb"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from anywhere — WAF in front (TODO) provides L7 filtering."
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

# HTTP -> HTTPS redirect needs port 80 open too.
resource "aws_vpc_security_group_ingress_rule" "alb_http_redirect" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP — listener redirects 301 to HTTPS, never serves payload."
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id            = aws_security_group.alb.id
  description                  = "ALB -> ECS tasks on all TCP ports (each target group enforces a single port)."
  ip_protocol                  = "tcp"
  from_port                    = 1
  to_port                      = 65535
  referenced_security_group_id = aws_security_group.ecs_task.id
}

# ----- ECS tasks (shared SG across all services) -----
# Single SG simplifies cross-service access; the network boundary
# we care about is private-subnet-vs-public-subnet, not service-to-service.
# (For zero-trust between services, switch to per-service SGs + explicit allow rules.)
resource "aws_security_group" "ecs_task" {
  name        = "eazepay-${var.environment}-ecs-task"
  description = "Fargate task ENIs. Accepts traffic from ALB; egress 443 only."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "eazepay-${var.environment}-ecs-task"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs_task.id
  description                  = "ALB -> Fargate task ports."
  ip_protocol                  = "tcp"
  from_port                    = 1
  to_port                      = 65535
  referenced_security_group_id = aws_security_group.alb.id
}

# Service-to-service via VPC internal networking (no service discovery yet
# — when we add Cloud Map / internal LB, this becomes a tighter ref).
resource "aws_vpc_security_group_ingress_rule" "ecs_from_self" {
  security_group_id            = aws_security_group.ecs_task.id
  description                  = "Service-to-service (any ECS task can call any other on standard ports)."
  ip_protocol                  = "tcp"
  from_port                    = 1
  to_port                      = 65535
  referenced_security_group_id = aws_security_group.ecs_task.id
}

resource "aws_vpc_security_group_egress_rule" "ecs_https_out" {
  security_group_id = aws_security_group.ecs_task.id
  description       = "HTTPS out — AWS APIs, Stripe, Resend, Pusher, MiCamp."
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "ecs_to_self" {
  security_group_id            = aws_security_group.ecs_task.id
  description                  = "Service-to-service egress."
  ip_protocol                  = "tcp"
  from_port                    = 1
  to_port                      = 65535
  referenced_security_group_id = aws_security_group.ecs_task.id
}

resource "aws_vpc_security_group_egress_rule" "ecs_to_rds" {
  security_group_id            = aws_security_group.ecs_task.id
  description                  = "Postgres."
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.rds.id
}

resource "aws_vpc_security_group_egress_rule" "ecs_to_redis" {
  security_group_id            = aws_security_group.ecs_task.id
  description                  = "Redis."
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
  referenced_security_group_id = aws_security_group.redis.id
}

# DNS — Fargate uses VPC resolver but explicit rule keeps the SG self-documenting.
resource "aws_vpc_security_group_egress_rule" "ecs_dns_udp" {
  security_group_id = aws_security_group.ecs_task.id
  description       = "DNS UDP to VPC resolver."
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = var.vpc_cidr
}

# ----- RDS -----
resource "aws_security_group" "rds" {
  name        = "eazepay-${var.environment}-rds"
  description = "Postgres. Accepts 5432 from ECS tasks ONLY."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "eazepay-${var.environment}-rds"
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  description                  = "Postgres from ECS tasks."
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.ecs_task.id
}

# ----- ElastiCache Redis -----
resource "aws_security_group" "redis" {
  name        = "eazepay-${var.environment}-redis"
  description = "Redis. Accepts 6379 from ECS tasks ONLY."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "eazepay-${var.environment}-redis"
  }
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_ecs" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis from ECS tasks."
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
  referenced_security_group_id = aws_security_group.ecs_task.id
}

# ----- VPC Endpoint SG (for interface endpoints later — SSM, Secrets, ECR) -----
# Not used today (we rely on NAT for these) but kept here so adding
# interface endpoints later is a one-line change.
resource "aws_security_group" "vpce" {
  name        = "eazepay-${var.environment}-vpce"
  description = "Interface VPC endpoints. Accepts 443 from ECS tasks."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "eazepay-${var.environment}-vpce"
  }
}

resource "aws_vpc_security_group_ingress_rule" "vpce_from_ecs" {
  security_group_id            = aws_security_group.vpce.id
  description                  = "HTTPS from ECS to interface endpoints."
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.ecs_task.id
}
