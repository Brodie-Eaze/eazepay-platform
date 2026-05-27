/**
 * variables.tf
 *
 * All inputs to the stack. `nullable = false` on anything that
 * MUST be set (region, account, env, domain) — Terraform will
 * fail fast rather than provision against the wrong target.
 *
 * `services` is the single source of truth for which workloads run
 * on ECS. Adding a service = add an entry to this map + re-apply;
 * Terraform creates the ECR repo, log group, task role, task def,
 * service, target group, and listener rule automatically via for_each.
 */

variable "aws_region" {
  type        = string
  description = "AWS region (us-east-1 — closest to MiCamp NJ, cheapest pricing tier)."
  default     = "us-east-1"
  nullable    = false
}

variable "aws_account_id" {
  type        = string
  description = "12-digit AWS account ID. Used to scope ARNs and as a safety check (provider refuses to apply against a different account)."
  nullable    = false

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be exactly 12 digits."
  }
}

variable "environment" {
  type        = string
  description = "Environment name. Used in tags, KMS aliases, secret names, log group names."
  default     = "prod"
  nullable    = false

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "domain_name" {
  type        = string
  description = "Apex domain hosted in Route53. e.g. eazepay.com — the data source in route53.tf looks up the zone by this name."
  default     = "eazepay.com"
  nullable    = false
}

variable "app_subdomain" {
  type        = string
  description = "Subdomain that points at the ALB. e.g. 'app' -> app.eazepay.com."
  default     = "app"
  nullable    = false
}

variable "acm_certificate_domain" {
  type        = string
  description = "Domain on the ACM certificate to attach to the ALB HTTPS listener. Cert is managed OUT-OF-BAND (DNS-validated) — Terraform looks it up via data source so re-issuance doesn't trigger a re-create."
  default     = "*.eazepay.com"
  nullable    = false
}

variable "ecr_image_tag" {
  type        = string
  description = "Default image tag to deploy when ECS service is created. Operator overrides per-service via `services` map. Use immutable tags (git SHA), never 'latest'."
  default     = "bootstrap"
  nullable    = false
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block. 10.0.0.0/16 gives ~65k IPs — plenty of headroom and doesn't overlap with common corp/VPN ranges (192.168.x, 172.16.x)."
  default     = "10.0.0.0/16"
  nullable    = false
}

variable "azs" {
  type        = list(string)
  description = "Availability zones. 3 AZs for HA — RDS Multi-AZ needs 2 minimum; 3 lets us tolerate a single AZ outage WHILE rebuilding."
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
  nullable    = false

  validation {
    condition     = length(var.azs) == 3
    error_message = "Must specify exactly 3 AZs (architecture assumes 3-AZ symmetric subnet layout)."
  }
}

variable "rds_instance_class" {
  type        = string
  description = "RDS instance class. db.t4g.medium is right-sized for early-stage load (~2 vCPU / 4 GiB) on Graviton (~20% cheaper than equivalent x86). Upsize via `terraform apply` when CPUUtilization sustains > 70%."
  default     = "db.t4g.medium"
  nullable    = false
}

variable "rds_allocated_storage_gb" {
  type        = number
  description = "Initial RDS storage in GB. gp3 — IOPS/throughput independent of size."
  default     = 100
  nullable    = false
}

variable "rds_max_allocated_storage_gb" {
  type        = number
  description = "Storage autoscaling ceiling. Prevents a runaway query from billing us into the next tax bracket."
  default     = 500
  nullable    = false
}

variable "rds_backup_retention_days" {
  type        = number
  description = "Daily snapshot retention. 7 days = covers 'noticed it Monday after weekend changes' rollback window. BSA records live in S3 audit bucket separately."
  default     = 7
  nullable    = false
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type. cache.t4g.micro = $0.016/hr — fine for session cache / rate limit counters at current scale. SCALE WARNING: this is single-node; prod hardening checklist includes flipping to cluster mode with replication group of 2+ nodes."
  default     = "cache.t4g.micro"
  nullable    = false
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention. 90 days = covers SOC2 incident-response window. Audit log goes to S3 Object Lock for the 7-year BSA requirement, NOT CloudWatch."
  default     = 90
  nullable    = false
}

variable "s3_audit_retention_days" {
  type        = number
  description = "S3 Object Lock GOVERNANCE retention for audit bucket. 2557 days = 7 years per Bank Secrecy Act 31 CFR 1010.430."
  default     = 2557
  nullable    = false
}

/**
 * services — single source of truth for ECS workloads.
 *
 * Per-service config:
 *  - cpu/memory: Fargate task size. 256/512 is the cheapest valid pairing.
 *  - desired_count: number of running tasks. >=2 for HA, 1 for cost-saving on internal/batch.
 *  - container_port: port the app listens on inside the container.
 *  - public: true = ALB listener rule routes to this service; false = internal only (service-to-service via discovery / private LB).
 *  - path_pattern: ALB path-based routing prefix (e.g. "/api/payment/*"). Only used when public=true.
 *  - priority: ALB listener rule priority. Lower = evaluated first. partner-portal catch-all goes LAST (highest number).
 *  - health_check_path: HTTP path that returns 200 when healthy.
 *
 * Add a service: append to this map, re-apply. for_each handles the rest.
 */
variable "services" {
  description = "Map of service name to per-service config. Drives ECR repos, ECS task defs, services, target groups, listener rules, log groups, IAM roles."
  nullable    = false

  type = map(object({
    cpu               = number
    memory            = number
    desired_count     = number
    container_port    = number
    public            = bool
    path_pattern      = optional(string, "")
    priority          = optional(number, 1000)
    health_check_path = optional(string, "/health")
  }))

  default = {
    partner-portal = {
      cpu               = 1024
      memory            = 2048
      desired_count     = 2
      container_port    = 3000
      public            = true
      path_pattern      = "/*" # catch-all — must be highest priority number
      priority          = 999
      health_check_path = "/api/health"
    }
    payment = {
      cpu               = 256
      memory            = 512
      desired_count     = 2
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    webhook = {
      cpu               = 256
      memory            = 512
      desired_count     = 2
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    notification = {
      cpu               = 256
      memory            = 512
      desired_count     = 1
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    user = {
      cpu               = 256
      memory            = 512
      desired_count     = 2
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    merchant = {
      cpu               = 256
      memory            = 512
      desired_count     = 2
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    lender = {
      cpu               = 256
      memory            = 512
      desired_count     = 2
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    billing = {
      cpu               = 256
      memory            = 512
      desired_count     = 2
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    compliance-doc = {
      cpu               = 256
      memory            = 512
      desired_count     = 1
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    auth = {
      cpu               = 256
      memory            = 512
      desired_count     = 2
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    audit = {
      cpu               = 256
      memory            = 512
      desired_count     = 1
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    risk = {
      cpu               = 256
      memory            = 512
      desired_count     = 1
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    admin = {
      cpu               = 256
      memory            = 512
      desired_count     = 1
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
    ezcheck = {
      cpu               = 256
      memory            = 512
      desired_count     = 1
      container_port    = 8080
      public            = false
      health_check_path = "/health"
    }
  }
}
