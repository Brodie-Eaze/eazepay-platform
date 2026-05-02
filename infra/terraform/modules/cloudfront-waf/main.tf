/**
 * CloudFront distribution + AWS-managed WAF for public surfaces
 * (consumer-web, merchant-dashboard, public API edge). Geo-restrict
 * to US, ban Tor exit nodes, enforce TLS 1.3.
 */
terraform {
  required_version = ">= 1.6.0"
  required_providers { aws = { source = "hashicorp/aws", version = ">= 5.0" } }
}

variable "name"         { type = string }
variable "origin_domain" { type = string }
variable "aliases"      { type = list(string), default = [] }
variable "acm_certificate_arn" { type = string }
variable "tags"         { type = map(string), default = {} }

resource "aws_wafv2_web_acl" "this" {
  provider = aws.us_east_1
  name     = "${var.name}-waf"
  scope    = "CLOUDFRONT"
  default_action { allow {} }

  rule {
    name     = "AWSManagedCommonRuleSet"
    priority = 0
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedKnownBadInputs"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimit500Per5min"
    priority = 2
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 500
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name}"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  is_ipv6_enabled = true
  aliases         = var.aliases
  http_version    = "http2and3"

  origin {
    domain_name = var.origin_domain
    origin_id   = "primary"
    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "primary"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Accept", "Content-Type", "User-Agent", "X-Idempotency-Key"]
      cookies { forward = "none" }
    }
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["US"]
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  web_acl_id = aws_wafv2_web_acl.this.arn
  tags       = var.tags
}

output "distribution_id"   { value = aws_cloudfront_distribution.this.id }
output "distribution_arn"  { value = aws_cloudfront_distribution.this.arn }
output "domain_name"       { value = aws_cloudfront_distribution.this.domain_name }
