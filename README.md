# 🔗 LinkFusion

[![CI](https://github.com/codemarquis/LinkFusion/actions/workflows/ci.yml/badge.svg)](https://github.com/codemarquis/LinkFusion/actions/workflows/ci.yml)
[![Security](https://github.com/codemarquis/LinkFusion/actions/workflows/security.yml/badge.svg)](https://github.com/codemarquis/LinkFusion/actions/workflows/security.yml)

A URL shortener with QR codes and **privacy-first click analytics**, built with zero-trust principles from the browser to the database, and deployable to AWS with hardened Terraform.

- **Short links** with custom aliases, titles, expiry dates, click limits and **password protection**
- **QR codes** for every link: colors, size, error correction, PNG/SVG download
- **Dashboard** with week-over-week trend, a 30-day click chart and a live recent-activity feed
- **Analytics**: clicks per day, an interactive **world map**, device/browser/OS donut charts, referrers and top links, with CSV export
- **Privacy by design**: visitor IPs are never stored; countries are resolved offline on the server
- **Accounts** with email + password or **Google, Apple and GitHub** sign-in, password change, GDPR data export and account deletion
- **Demo data on demand**: `npm run seed:demo` fills a local instance with 90 days of realistic traffic
- **Admin** console: system stats, link moderation, admin role management

![LinkFusion analytics: daily clicks, world map, device, browser and OS charts, referrers and recent activity](docs/screenshots/analytics.png)

---

## Screenshots

| Dashboard | Sign-in (Google · Apple · GitHub) |
|---|---|
| ![Dashboard with stats, 30-day chart, recent activity and links table](docs/screenshots/dashboard.png) | ![Sign-in page with Google, Apple and GitHub buttons](docs/screenshots/sign-in.png) |
| **QR codes** | **Admin** |
| ![QR code styling with live preview and PNG/SVG download](docs/screenshots/qr-codes.png) | ![Admin console with system stats and link moderation](docs/screenshots/admin.png) |
| **Landing page** | |
| ![Landing page](docs/screenshots/landing.png) | |

*Screenshots use the synthetic data from `npm run seed:demo`.*

---

## Architecture

```mermaid
flowchart LR
    subgraph client["Browser · React + Vite"]
        ui["Pages & components<br/>TanStack Query"]
        apiClient["lib/api.ts<br/>same-origin JSON"]
        ui --> apiClient
    end

    subgraph server["Node.js · Express"]
        direction TB
        mw["Middleware<br/>helmet · CSRF origin check<br/>rate limits · sessions · auth"]
        routes["Routes<br/>auth · links · analytics · QR<br/>profile · admin · redirects"]
        services["Services<br/>auth · links · redirect · analytics<br/>QR · passwords · click privacy"]
        repos["Repositories<br/>all SQL (Drizzle)"]
        mw --> routes --> services --> repos
    end

    shared["shared/<br/>schema + zod API contract"]
    pg[("PostgreSQL")]
    idp["Google · Apple · GitHub<br/>OAuth 2.0 / OpenID Connect"]

    apiClient -->|"HTTPS · session cookie"| mw
    repos --> pg
    routes <-->|"state + nonce · verified ID tokens"| idp
    shared -.-> client
    shared -.-> server
```

| Layer | Responsibility | Never does |
|---|---|---|
| `client/` | Rendering and user interaction | Holds secrets or decides authorization |
| `shared/` | Database schema and the request/response contract (zod) | Contains logic with side effects |
| `server/http/` | HTTP concerns: validation, sessions, security middleware, routing | Runs SQL directly |
| `server/services/` | Business rules: link policies, password hashing, analytics, privacy | Touches `req`/`res` |
| `server/repositories/` | All database access; owner checks in SQL `WHERE` clauses | Contains business rules |

### AWS deployment

```mermaid
flowchart TB
    user([Users]) -->|HTTPS| waf["AWS WAF<br/>managed rules + rate limit"]
    waf --> alb["Application Load Balancer<br/>TLS 1.3 · HTTP→HTTPS"]
    subgraph vpc["VPC"]
        subgraph public["Public subnets"]
            alb
            nat["NAT gateway"]
        end
        subgraph app["Private app subnets"]
            ecs["ECS Fargate tasks<br/>non-root · read-only FS<br/>no public IP"]
        end
        subgraph data["Private data subnets (no internet route)"]
            rds[("RDS PostgreSQL 16<br/>encrypted · TLS enforced")]
        end
    end
    alb -->|"SG: app port only"| ecs
    ecs -->|"SG: 5432 only · verify-full TLS"| rds
    ecs --> nat
    sm["Secrets Manager<br/>(KMS)"] -.->|"injected at start"| ecs
    ecr["ECR<br/>scan on push · immutable tags"] -.-> ecs
    ecs -.-> cw["CloudWatch logs & alarms"]
```

---

## Quick start

### Docker (everything included)

```bash
docker compose up --build
# open http://localhost:8080
```

### Local development

Requires Node.js 22+ and PostgreSQL 16.

```bash
npm install
docker run -d --name linkfusion-db -p 5432:5432 \
  -e POSTGRES_USER=linkfusion -e POSTGRES_PASSWORD=linkfusion -e POSTGRES_DB=linkfusion postgres:16-alpine

cp .env.example .env            # adjust if needed
set -a; source .env; set +a
npm run dev                     # http://localhost:3000 (migrations run automatically)

npm run create-admin -- you@example.com   # optional: make an account an administrator
npm run seed:demo                         # optional: demo account + 90 days of synthetic clicks
```

`seed:demo` creates `demo@linkfusion.local` with a **random password printed once**, 8 links (including password-protected, click-limited and expired ones), styled QR codes and about 4,000 anonymous clicks spread across 30 countries, devices, browsers and referrers. Running it again resets the demo. It refuses to run against production unless `ALLOW_DEMO_SEED=true`, and demo data never appears in anyone else's account. There is no built-in demo login or "demo mode".

> macOS: port 5000 is used by AirPlay Receiver, which is why local defaults use 3000 (and Docker uses 8080).

### Configuration

All settings are environment variables, validated at start-up. The app refuses to start in production with missing or weak values. See [`.env.example`](.env.example).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://…`; use `sslmode=verify-full` in production |
| `SESSION_SECRET` | production | 32+ random characters |
| `PUBLIC_BASE_URL` | production | `https://…`; used for short links, OAuth callbacks and CSRF origin checks |
| `TRUST_PROXY` | – | Number of proxy hops (1 behind a load balancer) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | – | Enables Google sign-in ([docs/oauth.md](docs/oauth.md)) |
| `GITHUB_CLIENT_ID` / `_SECRET` | – | Enables GitHub sign-in |
| `APPLE_CLIENT_ID` / `_TEAM_ID` / `_KEY_ID` / `_PRIVATE_KEY` | – | Enables Sign in with Apple |

The sign-in page always shows all three providers. A provider's button is disabled, with a hint, until its settings are present.

---

## Security

Highlights (details in [SECURITY.md](SECURITY.md)):

- **Every request is checked**: sessions are re-validated against the database on each request, so revoking admin rights or deleting an account takes effect immediately
- **CSRF protection** via strict `Origin` checks on every state-changing request, plus `SameSite` cookies
- **Input validation** on every endpoint with shared zod schemas; unknown fields are rejected (no mass assignment)
- **Passwords** hashed with scrypt; constant-time comparison; no user enumeration through timing
- **Rate limits** on sign-in, the API, redirects and password unlocks; AWS WAF in front in production
- **Strict security headers** (CSP, HSTS, frame denial, no MIME sniffing)
- **Privacy**: no IPs, full user agents or cities stored; CSV exports are protected against formula injection
- **Supply chain**: `npm audit`, Trivy, CodeQL, Gitleaks and Checkov run in CI

---

## Testing

```bash
npm run check                                       # TypeScript
TEST_DATABASE_URL=postgresql://linkfusion:linkfusion@localhost:5432/linkfusion npm test
```

The suite covers unit logic (validation, user-agent parsing, password hashing, CSV safety, config) and **API integration tests against a real PostgreSQL**: authentication, Sign in with Apple (state, nonce, audience and signature checks), CSRF, mass assignment, ownership, redirects (expiry, limits, passwords), analytics accuracy and consistency, the demo seed, QR rendering, admin authorization and account deletion.

---

## Deployment

See **[docs/deployment.md](docs/deployment.md)** for AWS (Terraform + GitHub Actions with OIDC, no stored AWS keys).

## Project structure

```
client/src/        React app (pages, components, hooks, lib/api.ts)
server/
  config.ts        validated configuration
  db.ts            PostgreSQL pool + migrations
  http/            app composition, middleware, routes
  services/        business logic
  repositories/    data access
  scripts/         migrate, create-admin, seed:demo
shared/            database schema + API contract (zod)
migrations/        SQL migrations (drizzle-kit)
tests/server/      unit + integration tests
terraform/         AWS infrastructure
.github/workflows/ CI, security scanning, deployment
```

## License

[MIT](LICENSE)
