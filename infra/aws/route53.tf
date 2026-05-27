/**
 * route53.tf
 *
 * Looks up the existing hosted zone for `var.domain_name` as a
 * data source. The DNS cutover record (app.eazepay.com -> ALB) is
 * INTENTIONALLY COMMENTED until the operator is ready to switch
 * traffic.
 *
 * Cutover procedure:
 *   1. Verify ALB is healthy + serving requests via its native DNS name
 *      (curl -k https://eazepay-prod-<id>.us-east-1.elb.amazonaws.com)
 *   2. Verify ACM cert is attached + valid (browser cert chain check)
 *   3. Uncomment the aws_route53_record block below
 *   4. terraform apply
 *   5. Watch DNS propagation: dig +short app.eazepay.com
 *   6. Smoke test via real domain
 *   7. Decommission Railway endpoint
 *
 * Rollback: comment record + apply, OR change to alias the Railway
 * endpoint (requires Railway-issued cert chain or CNAME).
 */

data "aws_route53_zone" "primary" {
  name         = var.domain_name
  private_zone = false
}

# resource "aws_route53_record" "app" {
#   zone_id = data.aws_route53_zone.primary.zone_id
#   name    = "${var.app_subdomain}.${var.domain_name}"
#   type    = "A"
#
#   alias {
#     name                   = aws_lb.main.dns_name
#     zone_id                = aws_lb.main.zone_id
#     evaluate_target_health = true
#   }
# }
#
# resource "aws_route53_record" "app_aaaa" {
#   zone_id = data.aws_route53_zone.primary.zone_id
#   name    = "${var.app_subdomain}.${var.domain_name}"
#   type    = "AAAA"
#
#   alias {
#     name                   = aws_lb.main.dns_name
#     zone_id                = aws_lb.main.zone_id
#     evaluate_target_health = true
#   }
# }

output "route53_zone_id" {
  value       = data.aws_route53_zone.primary.zone_id
  description = "Hosted zone ID for the configured domain_name. Used for the (currently commented) app subdomain record."
}
