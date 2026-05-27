/**
 * secrets.tf
 *
 * Creates secret SHELLS only — Terraform never sees real secret values.
 * The operator fills them in via the AWS Console / CLI after first
 * apply (procedure in README).
 *
 * Why shells? So:
 *   - ECS task definitions can reference the ARNs (resolved at task
 *     boot) and pass a valid `valueFrom` ARN to the container.
 *   - Terraform doesn't drift on secret rotation — `ignore_changes`
 *     on the secret value means rotation via Console / Lambda doesn't
 *     trigger a Terraform diff.
 *   - The placeholder value lets the stack apply cleanly; ECS task
 *     boot will fail with a "value is placeholder, replace me"
 *     error from the app, which is the right behavior.
 *
 * Each secret is encrypted with the data KMS key (kms_key_id ref).
 * Recovery window = 30 days (max) so accidental deletes are
 * recoverable.
 */

locals {
  secret_names = {
    database_url            = "DATABASE_URL"
    redis_url               = "REDIS_URL"
    demo_cookie_secret      = "DEMO_COOKIE_SECRET"
    account_cookie_secret   = "ACCOUNT_COOKIE_SECRET"
    micamp_webhook_secret   = "MICAMP_WEBHOOK_SECRET"
    highsale_webhook_secret = "HIGHSALE_WEBHOOK_SECRET"
    stripe_secret_key       = "STRIPE_SECRET_KEY"
    resend_api_key          = "RESEND_API_KEY"
    pusher_app_id           = "PUSHER_APP_ID"
    pusher_key              = "PUSHER_KEY"
    pusher_secret           = "PUSHER_SECRET"
    pusher_cluster          = "PUSHER_CLUSTER"
  }
}

resource "aws_secretsmanager_secret" "app" {
  for_each = local.secret_names

  name        = "/${var.environment}/eazepay/${each.value}"
  description = "${each.value} for eazepay ${var.environment} — managed by Terraform shell, value rotated out-of-band."
  kms_key_id  = aws_kms_key.data.arn

  recovery_window_in_days = 30

  tags = {
    Name      = each.value
    DataClass = "secret"
  }
}

# Seed with placeholder so the stack applies and ECS task definitions
# resolve. App MUST validate value != placeholder_value and crash if so.
resource "aws_secretsmanager_secret_version" "app_placeholder" {
  for_each = aws_secretsmanager_secret.app

  secret_id     = each.value.id
  secret_string = "placeholder_value_replace_me_via_console_or_cli"

  lifecycle {
    # Once operator overwrites the value, Terraform stops trying to
    # reset it to the placeholder.
    ignore_changes = [secret_string, version_stages]
  }
}

# Map for ECS task definition consumption: name -> ARN.
output "secret_arns" {
  value       = { for k, s in aws_secretsmanager_secret.app : local.secret_names[k] => s.arn }
  description = "Map of env-var name -> Secrets Manager ARN. ECS task definitions reference these via `valueFrom`."
}
