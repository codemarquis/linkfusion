# Security

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository. You'll get a response as soon as possible; please allow time for a fix before disclosing.

## Zero-trust model

LinkFusion assumes no request, input, network position or component is trustworthy by default.

| Boundary | Controls |
|---|---|
| **Browser → app** | HTTPS only (HSTS); strict Content Security Policy; frame denial; `SameSite=Lax`, `HttpOnly`, `Secure`, `__Host-` session cookie; CSRF blocked by `Origin` checks on every state-changing request |
| **Identity** | scrypt password hashing; constant-time comparison; same error and timing for unknown email vs. wrong password; new session id on sign-in (no fixation); OAuth accounts linked by email **only when the provider says the email is verified** |
| **Authorization** | The user is re-loaded from the database on every request, so admin revocation and account deletion apply instantly. Ownership is enforced in SQL (`WHERE user_id = …`), and other users' resources return 404 (not 403) |
| **Input** | Every body and query is validated by shared zod schemas; unknown fields are rejected (no mass assignment); destinations must be `http(s)` without credentials and can't point back at the shortener; body size limits |
| **Abuse** | Rate limits on sign-in/sign-up, the API, redirects and password unlocks; AWS WAF (managed rules, IP reputation, rate limit) in front of production |
| **Output** | Server-rendered pages escape all values; QR SVGs are served with a locked-down CSP; CSV exports neutralise spreadsheet formulas |
| **Privacy** | No visitor IPs, full user agents or cities stored. Country lookup is offline (no third-party geolocation). Referrers are reduced to their domain. Bots aren't counted |
| **Secrets** | Never in code, images or task definitions. AWS Secrets Manager (KMS-encrypted) injects them at start; OAuth secrets never pass through Terraform state. The app refuses to start in production with a missing/weak `SESSION_SECRET` |
| **Network (AWS)** | Tasks in private subnets without public IPs; the database in subnets with no internet route; each security group only accepts traffic from the tier in front of it; TLS 1.3 at the load balancer; TLS with certificate verification to RDS (`rds.force_ssl=1`, `sslmode=verify-full`) |
| **Runtime** | Non-root container, read-only root filesystem, all Linux capabilities dropped, no shell access into production tasks (ECS Exec disabled), automatic rollback of failed deployments |
| **Supply chain** | `npm audit`, Trivy (image + filesystem), CodeQL, Gitleaks, Checkov on every PR and weekly; immutable, scanned ECR images; deploys via GitHub OIDC with no stored AWS keys and a required approval |

### Accepted exceptions

Checkov findings that are intentionally skipped are documented inline in `terraform/` with the reason (e.g. port 80 open only for the HTTPS redirect, Multi-AZ as a cost decision).

## Should I add a VPN such as WireGuard?

**Not for visitors, but yes for operators.**

- **Public traffic:** a URL shortener has to be reachable by anyone who clicks a link. Putting the app behind a VPN would break the product. Protection here comes from TLS, WAF, rate limiting and the application controls above.
- **The admin plane is where a VPN helps.** Anything only operators use (database access for maintenance, internal dashboards, a future admin-only hostname) shouldn't be exposed to the internet at all. A WireGuard gateway (or a managed WireGuard network such as Tailscale) gives operators a private, key-authenticated path into the VPC with a tiny attack surface.
- **On AWS, consider first:** **SSM Session Manager** port forwarding or **EC2 Instance Connect Endpoint** reach private resources with IAM authentication, no open ports and full audit logs, and need no VPN server to maintain. Use WireGuard when you want one private network across environments, laptops and on-prem machines.

Recommended setup: keep the public app as it is, and give operators either SSM-based access or a small WireGuard bastion in a public subnet that only accepts UDP 51820 and routes to the private subnets. If you later add an admin-only hostname, serve it only inside that private network.
