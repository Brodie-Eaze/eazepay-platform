/**
 * ECS Fargate service template. One service = one logical app
 * (apps/api, apps/workers, apps/webhooks). Logs to CloudWatch with
 * KMS encryption; tasks run in private subnets behind an internal
 * ALB; deploy strategy is rolling with circuit breaker enabled.
 */
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

variable "name"             { type = string }
variable "cluster_id"       { type = string }
variable "image"            { type = string }
variable "container_port"   { type = number, default = 3000 }
variable "task_cpu"         { type = string, default = "1024" }
variable "task_memory"      { type = string, default = "2048" }
variable "desired_count"    { type = number, default = 2 }
variable "subnet_ids"       { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "task_role_arn"    { type = string }
variable "execution_role_arn" { type = string }
variable "log_kms_key_arn"  { type = string }
variable "env_vars"         { type = list(object({ name = string, value = string })), default = [] }
variable "secret_arns"      { type = list(object({ name = string, valueFrom = string })), default = [] }
variable "tags"             { type = map(string), default = {} }

resource "aws_cloudwatch_log_group" "this" {
  name              = "/eazepay/${var.name}"
  retention_in_days = 30
  kms_key_id        = var.log_kms_key_arn
  tags              = var.tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name         = var.name
      image        = var.image
      essential    = true
      portMappings = [{ containerPort = var.container_port, protocol = "tcp" }]
      environment  = var.env_vars
      secrets      = var.secret_arns
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = var.name
        }
      }
      readonlyRootFilesystem = true
      linuxParameters = {
        initProcessEnabled = true
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  enable_execute_command = true
  propagate_tags         = "TASK_DEFINITION"
  tags                   = var.tags
}

data "aws_region" "current" {}

output "service_name"     { value = aws_ecs_service.this.name }
output "task_definition_arn" { value = aws_ecs_task_definition.this.arn }
