output "load_balancer_dns_name" {
  description = "Point your domain's CNAME (or Route 53 alias) here"
  value       = aws_lb.main.dns_name
}

output "app_url" {
  value = local.public_url
}

output "ecr_repository_url" {
  description = "Push images here"
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "oauth_secret_arns" {
  description = "Set these once: aws secretsmanager put-secret-value --secret-id <arn> --secret-string '<client secret>'"
  value       = { for s in local.oauth_secrets : s.name => s.valueFrom }
}

output "database_endpoint" {
  description = "Private endpoint, reachable only from app tasks"
  value       = aws_db_instance.main.endpoint
}
