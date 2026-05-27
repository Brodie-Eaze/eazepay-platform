/**
 * ecr.tf
 *
 * One ECR repo per service (14 total). Lifecycle policy keeps the
 * last 10 images by tag — anything older gets pruned automatically.
 *
 * Image tag immutability is ON: prevents an attacker (or a rushed
 * deploy) from overwriting an existing tag with different bytes.
 * Combined with image scanning + cosign signing in CI, this gives
 * us a verifiable supply chain.
 *
 * Repo name = "eazepay/<service>" — namespaced so multiple projects
 * can share an account without colliding.
 */

resource "aws_ecr_repository" "service" {
  for_each = var.services

  name                 = "eazepay/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.data.arn
  }

  tags = {
    Name    = "eazepay-${each.key}"
    Service = each.key
  }
}

resource "aws_ecr_lifecycle_policy" "service" {
  for_each   = aws_ecr_repository.service
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["*"]
          countType      = "imageCountMoreThan"
          countNumber    = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      }
    ]
  })
}

output "ecr_repository_urls" {
  value       = { for k, r in aws_ecr_repository.service : k => r.repository_url }
  description = "Map of service name -> ECR repo URL. CI pushes images here."
}
