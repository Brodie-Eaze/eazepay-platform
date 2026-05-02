/**
 * VPC + 3-AZ subnet layout. Public subnets host the ALB/NAT only;
 * private subnets host compute; isolated subnets host data services
 * (Aurora, ElastiCache) with no NAT egress. Flow logs to a
 * cross-account S3 bucket via the audit account.
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

variable "name"       { type = string }
variable "cidr_block" { type = string }
variable "azs"        { type = list(string) }
variable "tags"       { type = map(string), default = {} }
variable "flow_log_bucket_arn" { type = string }

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = var.name })
}

resource "aws_subnet" "public" {
  for_each                = toset(var.azs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, 4, index(var.azs, each.value))
  availability_zone       = each.value
  map_public_ip_on_launch = true
  tags = merge(var.tags, {
    Name = "${var.name}-public-${each.value}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  for_each          = toset(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 4, length(var.azs) + index(var.azs, each.value))
  availability_zone = each.value
  tags = merge(var.tags, {
    Name = "${var.name}-private-${each.value}"
    Tier = "private"
  })
}

resource "aws_subnet" "isolated" {
  for_each          = toset(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 4, 2 * length(var.azs) + index(var.azs, each.value))
  availability_zone = each.value
  tags = merge(var.tags, {
    Name = "${var.name}-isolated-${each.value}"
    Tier = "isolated"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name}-igw" })
}

resource "aws_eip" "nat" {
  for_each = toset(var.azs)
  domain   = "vpc"
  tags     = merge(var.tags, { Name = "${var.name}-nat-${each.value}" })
}

resource "aws_nat_gateway" "this" {
  for_each      = toset(var.azs)
  allocation_id = aws_eip.nat[each.value].id
  subnet_id     = aws_subnet.public[each.value].id
  tags          = merge(var.tags, { Name = "${var.name}-nat-${each.value}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.name}-rt-public" })
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  for_each = toset(var.azs)
  vpc_id   = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[each.value].id
  }
  tags = merge(var.tags, { Name = "${var.name}-rt-private-${each.value}" })
}

resource "aws_route_table_association" "private" {
  for_each       = aws_subnet.private
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[each.key].id
}

# Isolated subnets get a route table with no default route — egress
# is via VPC endpoints only. S3 + DynamoDB endpoints declared here;
# ECR / Secrets Manager / KMS endpoints land in env stacks.
resource "aws_route_table" "isolated" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name}-rt-isolated" })
}

resource "aws_route_table_association" "isolated" {
  for_each       = aws_subnet.isolated
  subnet_id      = each.value.id
  route_table_id = aws_route_table.isolated.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private[var.azs[0]].id, aws_route_table.isolated.id]
  tags              = merge(var.tags, { Name = "${var.name}-vpce-s3" })
}

resource "aws_flow_log" "this" {
  vpc_id               = aws_vpc.this.id
  log_destination_type = "s3"
  log_destination      = var.flow_log_bucket_arn
  traffic_type         = "ALL"
  tags                 = merge(var.tags, { Name = "${var.name}-flow-logs" })
}

data "aws_region" "current" {}

output "vpc_id"             { value = aws_vpc.this.id }
output "public_subnet_ids"   { value = [for s in aws_subnet.public : s.id] }
output "private_subnet_ids"  { value = [for s in aws_subnet.private : s.id] }
output "isolated_subnet_ids" { value = [for s in aws_subnet.isolated : s.id] }
