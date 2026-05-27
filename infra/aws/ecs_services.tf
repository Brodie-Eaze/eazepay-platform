/**
 * ecs_services.tf
 *
 * For each entry in var.services:
 *   - Task definition (Fargate, awsvpc network mode)
 *   - Service (desired_count, attached to ALB target group)
 *
 * Bootstrap pattern: the task definition references the ECR image
 * URL with var.ecr_image_tag (default "bootstrap"). CI updates the
 * task definition out-of-band on each deploy (via aws-actions/
 * amazon-ecs-deploy-task-definition or similar). Terraform then
 * `ignore_changes = [task_definition]` on the service so re-applies
 * don't roll back the deploy.
 *
 * Secrets injection: all 12 app secrets get mapped into env at boot
 * via valueFrom -> Secrets Manager ARN. ECS resolves these via the
 * execution role; they never appear in the task def plaintext.
 *
 * Container hardening:
 *   - readonlyRootFilesystem = true (write access only to /tmp via tmpfs)
 *   - non-root user enforced at app Dockerfile level (this skeleton
 *     doesn't override; the Dockerfile is expected to USER 1000)
 *   - linuxParameters.initProcessEnabled = true (proper signal handling)
 *
 * Public services additionally depend on aws_lb_listener_rule so the
 * routing exists before the service comes up.
 */

# Compose env vars + secrets per service. Service-specific overrides
# can be added by branching on each.key later.
locals {
  common_env = [
    { name = "NODE_ENV", value = var.environment == "prod" ? "production" : var.environment },
    { name = "AWS_REGION", value = var.aws_region },
    { name = "LOG_LEVEL", value = "info" },
    { name = "AUDIT_S3_BUCKET", value = aws_s3_bucket.audit.bucket },
    { name = "ARTIFACTS_S3_BUCKET", value = aws_s3_bucket.artifacts.bucket },
    { name = "KEK_ALIAS", value = aws_kms_alias.kek.name },
  ]

  # All secrets, mapped into env for every service.
  # Tighten per-service later (e.g. only payment service should see STRIPE_SECRET_KEY).
  common_secrets = [
    for name, secret in aws_secretsmanager_secret.app : {
      name      = local.secret_names[name]
      valueFrom = secret.arn
    }
  ]
}

resource "aws_ecs_task_definition" "service" {
  for_each = var.services

  family                   = "eazepay-${var.environment}-${each.key}"
  cpu                      = tostring(each.value.cpu)
  memory                   = tostring(each.value.memory)
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task[each.key].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64" # Graviton — ~20% cheaper than X86_64; Dockerfiles must build arm64
  }

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${aws_ecr_repository.service[each.key].repository_url}:${var.ecr_image_tag}"
      essential = true

      portMappings = [{
        containerPort = each.value.container_port
        protocol      = "tcp"
      }]

      environment = local.common_env
      secrets     = local.common_secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = each.key
        }
      }

      readonlyRootFilesystem = true

      # Writable /tmp via tmpfs — many Node libs write here for sharp / pdf-gen.
      mountPoints = []

      linuxParameters = {
        initProcessEnabled = true
        tmpfs = [{
          containerPath = "/tmp"
          size          = 256 # MB
          mountOptions  = ["rw", "noexec", "nosuid"]
        }]
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "wget -q --spider http://localhost:${each.value.container_port}${each.value.health_check_path} || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      stopTimeout = 30
    }
  ])

  tags = {
    Name    = "eazepay-${var.environment}-td-${each.key}"
    Service = each.key
  }

  lifecycle {
    # CI updates image tag per deploy; don't fight it.
    ignore_changes = [container_definitions]
  }
}

resource "aws_ecs_service" "service" {
  for_each = var.services

  name            = "eazepay-${var.environment}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.service[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  platform_version                  = "LATEST"
  enable_execute_command            = true
  health_check_grace_period_seconds = each.value.public ? 60 : 0
  propagate_tags                    = "SERVICE"

  network_configuration {
    subnets          = [for s in aws_subnet.private : s.id]
    security_groups  = [aws_security_group.ecs_task.id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = each.value.public ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.service[each.key].arn
      container_name   = each.key
      container_port   = each.value.container_port
    }
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true # auto-rollback on failed deploy
  }

  deployment_controller {
    type = "ECS" # rolling
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  tags = {
    Name    = "eazepay-${var.environment}-svc-${each.key}"
    Service = each.key
  }

  lifecycle {
    # CI updates task_definition per deploy.
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy.task_baseline,
  ]
}

# Service autoscaling — wire CPU-based target tracking on public services.
resource "aws_appautoscaling_target" "service" {
  for_each = { for k, v in var.services : k => v if v.public }

  max_capacity       = 10
  min_capacity       = each.value.desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.service[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "service_cpu" {
  for_each = aws_appautoscaling_target.service

  name               = "eazepay-${var.environment}-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = each.value.resource_id
  scalable_dimension = each.value.scalable_dimension
  service_namespace  = each.value.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 60.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
