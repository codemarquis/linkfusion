terraform {
  required_version = ">= 1.6"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }

  # Remote state (recommended for teams). Create the bucket and table once, then uncomment:
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "linkfusion/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = var.app_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  #checkov:skip=CKV_AWS_394:The first two available AZs are fine for this workload
  state = "available"
}

locals {
  name       = "${var.app_name}-${var.environment}"
  azs        = slice(data.aws_availability_zones.available.names, 0, 2)
  app_port   = 5000
  public_url = "https://${var.domain_name}"
}
