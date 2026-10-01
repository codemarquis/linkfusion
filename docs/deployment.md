# Deploying LinkFusion to AWS

The `terraform/` directory builds a production environment: VPC with private subnets, ECS Fargate, an Application Load Balancer with TLS 1.3, optional WAF, RDS PostgreSQL 16 with enforced TLS, Secrets Manager, KMS, ECR and CloudWatch alarms. See [SECURITY.md](../SECURITY.md) for the security model.

## Prerequisites

- An AWS account and the AWS CLI
- Terraform ≥ 1.6
- A domain, and an **ACM certificate** for it in your chosen region
- Docker (to build the first image)

## 1. One-time bootstrap

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # set domain_name, certificate_arn, alarm_email, …
```

For team use, create an S3 bucket + DynamoDB table for remote state and uncomment the `backend "s3"` block in `versions.tf`.

The ECR repository has to exist before the first image push, so create it first:

```bash
terraform init
terraform apply -target=aws_ecr_repository.app
```

## 2. Build and push the first image

```bash
REPO=$(terraform output -raw ecr_repository_url)
aws ecr get-login-password | docker login --username AWS --password-stdin "${REPO%/*}"
TAG=$(git rev-parse --short HEAD)
docker build -t "$REPO:$TAG" ..
docker push "$REPO:$TAG"
```

Set `container_image = "<REPO>:<TAG>"` in `terraform.tfvars`.

## 3. Create everything

```bash
terraform apply
```

Then:

1. Point your domain at `load_balancer_dns_name` (CNAME, or a Route 53 alias record).
2. Optional OAuth: put each client secret into the ARNs from `terraform output oauth_secret_arns`:
   ```bash
   aws secretsmanager put-secret-value --secret-id <arn> --secret-string '<client secret>'
   aws ecs update-service --cluster <cluster> --service <service> --force-new-deployment
   ```
3. Make yourself an administrator. Sign up in the app, then run the admin script as a one-off task, or connect through your operator access path (see SECURITY.md → VPN) and run:
   ```bash
   DATABASE_URL='<from Secrets Manager>' npm run create-admin -- you@example.com
   ```

## 4. Continuous deployment (GitHub Actions)

`.github/workflows/deploy.yml` builds, scans and pushes an image tagged with the commit SHA, then runs `terraform apply` after a reviewer approves.

One-time setup:

1. **OIDC role**: create an IAM OIDC provider for `token.actions.githubusercontent.com` and a role whose trust policy only allows this repository's `main` branch and `production` environment, e.g.
   `"token.actions.githubusercontent.com:sub": "repo:codemarquis/LinkFusion:environment:production"`.
   Grant it what Terraform manages here, plus ECR push.
2. **Repository variables**: `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `ECR_REPOSITORY` (e.g. `linkfusion`).
3. **Environment** `production` with required reviewers, and the secret `TFVARS` (the contents of your `terraform.tfvars` without `container_image`).
4. **Remote state** configured (step 1), since CI runners are ephemeral.

## Operations

| Task | How |
|---|---|
| Logs | CloudWatch log group `/ecs/<app>-<env>` |
| Alarms | 5xx errors, unhealthy tasks, database CPU and storage → SNS → `alarm_email` |
| Roll back | Re-run the deploy workflow for an earlier commit (images are immutable), or `terraform apply -var container_image=<older tag>` |
| Rotate the session secret | `terraform apply -replace=random_password.session`, then force a new deployment (signs everyone out) |
| Rotate the database password | `terraform apply -replace=random_password.db` (updates RDS and the `DATABASE_URL` secret), then force a new deployment |
| Scale | `desired_count`, `task_cpu`, `task_memory`, `db_instance_class`, `db_multi_az` |

## Costs (approximate, eu-central-1)

ALB ~18 USD, NAT gateway ~32 USD (disable with `enable_nat_gateway = false` if you don't use Google/GitHub sign-in), 2 small Fargate tasks ~30 USD, db.t4g.micro ~13 USD, WAF ~6 USD + requests, per month.
