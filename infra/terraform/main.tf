terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type        = string
  description = "AWS region for VaultOps platform resources."
  default     = "us-east-1"
}

variable "project" {
  type        = string
  description = "Name prefix for resources."
  default     = "vaultops"
}

resource "aws_kms_key" "vaultops" {
  description             = "${var.project} credential DEK wrapping"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "vaultops" {
  name          = "alias/${var.project}-credentials"
  target_key_id = aws_kms_key.vaultops.key_id
}

output "kms_key_arn" {
  value       = aws_kms_key.vaultops.arn
  description = "Pass to API as KMS_KEY_ID."
}

output "kms_alias_arn" {
  value       = aws_kms_alias.vaultops.arn
  description = "Alternative KMS_KEY_ID value."
}

# NOTE: Full VPC + ECS + RDS + ElastiCache is intentionally out of scope for this skeleton.
# Extend this stack with aws_ecs_cluster, aws_ecs_service, aws_lb, aws_rds_cluster, aws_elasticache_replication_group,
# and GitHub Actions OIDC roles for deployment.
