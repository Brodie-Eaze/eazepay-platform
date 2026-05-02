/**
 * One CMK per data class so we can rotate / restrict / audit
 * independently. Per ARCHITECTURE.md §16.5: pii / docs / payments /
 * logs distinct keys.
 */
terraform {
  required_version = ">= 1.6.0"
  required_providers { aws = { source = "hashicorp/aws", version = ">= 5.0" } }
}

variable "name"           { type = string }
variable "data_class"     { type = string }
variable "alias"          { type = string }
variable "key_admins"     { type = list(string) }
variable "key_users"      { type = list(string), default = [] }
variable "tags"           { type = map(string), default = {} }

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "key" {
  statement {
    sid = "EnableIAMUserPermissions"
    actions = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
  dynamic "statement" {
    for_each = length(var.key_admins) > 0 ? [1] : []
    content {
      sid = "AllowAdmins"
      actions = [
        "kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*", "kms:Put*",
        "kms:Update*", "kms:Revoke*", "kms:Disable*", "kms:Get*", "kms:Delete*",
        "kms:TagResource", "kms:UntagResource", "kms:ScheduleKeyDeletion",
        "kms:CancelKeyDeletion",
      ]
      resources = ["*"]
      principals {
        type        = "AWS"
        identifiers = var.key_admins
      }
    }
  }
  dynamic "statement" {
    for_each = length(var.key_users) > 0 ? [1] : []
    content {
      sid = "AllowUseOfTheKey"
      actions = [
        "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*",
        "kms:GenerateDataKey*", "kms:DescribeKey",
      ]
      resources = ["*"]
      principals {
        type        = "AWS"
        identifiers = var.key_users
      }
    }
  }
}

resource "aws_kms_key" "this" {
  description             = "${var.name} (${var.data_class})"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.key.json
  tags                    = merge(var.tags, { DataClass = var.data_class })
}

resource "aws_kms_alias" "this" {
  name          = var.alias
  target_key_id = aws_kms_key.this.key_id
}

output "key_arn" { value = aws_kms_key.this.arn }
output "key_id"  { value = aws_kms_key.this.key_id }
