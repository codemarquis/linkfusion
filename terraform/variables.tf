variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-central-1"
}

variable "app_name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "linkfusion"
}

variable "environment" {
  description = "Environment name (e.g. production, staging)"
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Public domain the app is served on (e.g. lnk.example.com). Must be covered by certificate_arn."
  type        = string
}

variable "certificate_arn" {
  description = "ARN of an ACM certificate for domain_name in aws_region"
  type        = string
}

variable "container_image" {
  description = "Container image to run (e.g. <account>.dkr.ecr.<region>.amazonaws.com/linkfusion:<git-sha>)"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Give tasks outbound internet access (needed for Google/GitHub sign-in). One NAT gateway, ~32 USD/month."
  type        = bool
  default     = true
}

variable "desired_count" {
  description = "Number of running app tasks"
  type        = number
  default     = 2
}

variable "task_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 1024
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_multi_az" {
  description = "Run the database in two availability zones"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Protect the database and load balancer from deletion"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Attach an AWS WAF web ACL (managed common rules + per-IP rate limit) to the load balancer"
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "Max requests per 5 minutes per IP before WAF blocks"
  type        = number
  default     = 2000
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarm notifications (empty to skip)"
  type        = string
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth client ID (optional)"
  type        = string
  default     = ""
}

variable "github_client_id" {
  description = "GitHub OAuth client ID (optional)"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention"
  type        = number
  default     = 365
}

variable "alb_access_logs_bucket" {
  description = "Existing S3 bucket for load balancer access logs (empty to disable)"
  type        = string
  default     = ""
}
