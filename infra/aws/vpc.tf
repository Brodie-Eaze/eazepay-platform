/**
 * vpc.tf
 *
 * Network layout for prod. 10.0.0.0/16 across 3 AZs:
 *
 *   AZ a: public 10.0.0.0/20   private 10.0.16.0/20
 *   AZ b: public 10.0.32.0/20  private 10.0.48.0/20
 *   AZ c: public 10.0.64.0/20  private 10.0.80.0/20
 *
 * Each /20 = 4091 usable IPs — leaves room for thousands of Fargate
 * tasks per AZ before we exhaust subnets.
 *
 * COST/HA TRADEOFF — 3 NAT Gateways (one per AZ):
 *   Cost:   ~$32/mo per NAT * 3 = ~$96/mo + data processing
 *   Benefit: AZ failure does not take down egress for surviving AZs,
 *            and cross-AZ NAT traffic ($0.01/GB) is avoided.
 *   Single NAT alternative: ~$32/mo but a single AZ failure kills
 *   ALL egress, which means ECS tasks can't pull images / call
 *   webhooks / refresh secrets. For a payments service, the $64/mo
 *   savings is not worth the blast radius.
 *
 * For staging/dev: flip `single_nat_gateway = true` (not implemented
 * in this skeleton — add the conditional when we stand up non-prod).
 */

# Lookup AZ details (mainly to validate the names exist in this region).
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "eazepay-${var.environment}-vpc"
  }
}

# ----- Internet Gateway (for public subnets only) -----
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "eazepay-${var.environment}-igw"
  }
}

# ----- Public subnets (10.0.0.0/20, 10.0.32.0/20, 10.0.64.0/20) -----
# ALB lives here. ECS tasks do NOT.
resource "aws_subnet" "public" {
  for_each = { for idx, az in var.azs : az => idx }

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, each.value * 2) # /20
  map_public_ip_on_launch = false                                       # NLB/ALB get their own EIPs

  tags = {
    Name = "eazepay-${var.environment}-public-${each.key}"
    Tier = "public"
  }
}

# ----- Private subnets (10.0.16.0/20, 10.0.48.0/20, 10.0.80.0/20) -----
# ECS tasks, RDS, ElastiCache all live here. No direct internet ingress.
resource "aws_subnet" "private" {
  for_each = { for idx, az in var.azs : az => idx }

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, each.value * 2 + 1) # /20

  tags = {
    Name = "eazepay-${var.environment}-private-${each.key}"
    Tier = "private"
  }
}

# ----- NAT Gateways — one per AZ for HA (see header comment) -----
resource "aws_eip" "nat" {
  for_each = toset(var.azs)
  domain   = "vpc"

  tags = {
    Name = "eazepay-${var.environment}-nat-eip-${each.key}"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  for_each = toset(var.azs)

  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id

  tags = {
    Name = "eazepay-${var.environment}-nat-${each.key}"
  }

  depends_on = [aws_internet_gateway.main]
}

# ----- Route tables -----

# Public RT: default route to IGW. Shared across all public subnets.
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "eazepay-${var.environment}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# Private RT: one per AZ — each points at the NAT in the same AZ
# (avoids cross-AZ data charges on egress).
resource "aws_route_table" "private" {
  for_each = toset(var.azs)
  vpc_id   = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[each.key].id
  }

  tags = {
    Name = "eazepay-${var.environment}-private-rt-${each.key}"
  }
}

resource "aws_route_table_association" "private" {
  for_each       = aws_subnet.private
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[each.key].id
}

# ----- VPC Endpoints (cost optimization — keep S3/ECR traffic off NAT) -----
# Gateway endpoint for S3: free, dramatically reduces NAT data charges
# (ECR image pulls + Secrets Manager + CloudWatch logs all hit S3 under
# the hood).
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [for rt in aws_route_table.private : rt.id]

  tags = {
    Name = "eazepay-${var.environment}-vpce-s3"
  }
}

# ----- Outputs (used by other modules + visible after apply) -----
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID for all eazepay prod resources."
}

output "private_subnet_ids" {
  value       = [for s in aws_subnet.private : s.id]
  description = "Private subnet IDs (ECS, RDS, ElastiCache live here)."
}

output "public_subnet_ids" {
  value       = [for s in aws_subnet.public : s.id]
  description = "Public subnet IDs (ALB lives here)."
}
