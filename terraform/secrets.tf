# Secrets live in Secrets Manager and are injected into the container by ECS at
# start-up. They never appear in the task definition, the image or the repo.

resource "random_password" "session" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name}/database-url"
  description             = "PostgreSQL connection URL (TLS, certificate verified)"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.main.arn
  #checkov:skip=CKV2_AWS_57:Rotation needs a rotation Lambda; rotate by re-applying with a new random_password (see docs/deployment.md)
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "postgresql://%s:%s@%s/%s?sslmode=verify-full&sslrootcert=/app/certs/rds-global-bundle.pem",
    aws_db_instance.main.username,
    random_password.db.result,
    aws_db_instance.main.endpoint,
    aws_db_instance.main.db_name,
  )
}

resource "aws_secretsmanager_secret" "session_secret" {
  name                    = "${local.name}/session-secret"
  description             = "Signs session cookies"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.main.arn
  #checkov:skip=CKV2_AWS_57:Rotation needs a rotation Lambda; rotate by re-applying with a new random_password (see docs/deployment.md)
}

resource "aws_secretsmanager_secret_version" "session_secret" {
  secret_id     = aws_secretsmanager_secret.session_secret.id
  secret_string = random_password.session.result
}

# OAuth client secrets are created empty and set once by an operator, so they
# never pass through Terraform state:
#   aws secretsmanager put-secret-value --secret-id <arn> --secret-string '<secret>'
resource "aws_secretsmanager_secret" "google_client_secret" {
  count                   = var.google_client_id == "" ? 0 : 1
  name                    = "${local.name}/google-client-secret"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.main.arn
  #checkov:skip=CKV2_AWS_57:Rotation needs a rotation Lambda; rotate by re-applying with a new random_password (see docs/deployment.md)
}

resource "aws_secretsmanager_secret" "github_client_secret" {
  count                   = var.github_client_id == "" ? 0 : 1
  name                    = "${local.name}/github-client-secret"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.main.arn
  #checkov:skip=CKV2_AWS_57:Rotation needs a rotation Lambda; rotate by re-applying with a new random_password (see docs/deployment.md)
}

resource "aws_secretsmanager_secret" "apple_private_key" {
  count                   = var.apple_sign_in == null ? 0 : 1
  name                    = "${local.name}/apple-private-key"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.main.arn
  #checkov:skip=CKV2_AWS_57:Rotation needs a rotation Lambda; rotate by re-applying with a new random_password (see docs/deployment.md)
}

locals {
  oauth_secrets = concat(
    [for s in aws_secretsmanager_secret.google_client_secret : { name = "GOOGLE_CLIENT_SECRET", valueFrom = s.arn }],
    [for s in aws_secretsmanager_secret.github_client_secret : { name = "GITHUB_CLIENT_SECRET", valueFrom = s.arn }],
    [for s in aws_secretsmanager_secret.apple_private_key : { name = "APPLE_PRIVATE_KEY", valueFrom = s.arn }],
  )
  app_secret_arns = concat(
    [aws_secretsmanager_secret.database_url.arn, aws_secretsmanager_secret.session_secret.arn],
    [for s in local.oauth_secrets : s.valueFrom],
  )
}
