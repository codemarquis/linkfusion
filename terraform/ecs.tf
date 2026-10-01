resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ---- IAM: least privilege ---------------------------------------------------

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Used by ECS itself to pull the image, write logs and read this app's secrets.
resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-app-secrets"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = local.app_secret_arns # only these secrets, nothing else
    }]
  })
}

# The running app calls no AWS APIs, so its role grants nothing.
resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# ---- task definition --------------------------------------------------------

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  volume {
    name = "tmp"
  }

  container_definitions = jsonencode([{
    name                   = var.app_name
    image                  = var.container_image
    essential              = true
    readonlyRootFilesystem = true # the app never writes to disk; /tmp is a scratch volume
    user                   = "node"
    portMappings           = [{ containerPort = local.app_port, protocol = "tcp" }]
    mountPoints            = [{ sourceVolume = "tmp", containerPath = "/tmp", readOnly = false }]

    environment = concat(
      [
        { name = "NODE_ENV", value = "production" },
        { name = "HOST", value = "0.0.0.0" },
        { name = "PORT", value = tostring(local.app_port) },
        { name = "PUBLIC_BASE_URL", value = local.public_url },
        { name = "TRUST_PROXY", value = "1" }, # exactly one hop: the ALB
        { name = "MIGRATE_ON_START", value = "true" },
      ],
      var.google_client_id == "" ? [] : [{ name = "GOOGLE_CLIENT_ID", value = var.google_client_id }],
      var.github_client_id == "" ? [] : [{ name = "GITHUB_CLIENT_ID", value = var.github_client_id }],
    )

    secrets = concat(
      [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "SESSION_SECRET", valueFrom = aws_secretsmanager_secret.session_secret.arn },
      ],
      local.oauth_secrets,
    )

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:${local.app_port}/api/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "app"
      }
    }
  }])
}

resource "aws_ecs_service" "app" {
  name                              = local.name
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.app.arn
  desired_count                     = var.desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60
  enable_execute_command            = false # no shell access into production containers
  propagate_tags                    = "SERVICE"

  network_configuration {
    subnets          = aws_subnet.app[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false # tasks are only reachable through the load balancer
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.app_name
    container_port   = local.app_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true # a release that fails health checks is rolled back automatically
  }

  depends_on = [aws_lb_listener.https]
}
