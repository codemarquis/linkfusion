# Contributing

Thanks for helping improve LinkFusion!

## Setup

```bash
npm install
docker compose up -d db          # PostgreSQL on localhost:5432 (or use your own)
cp .env.example .env && set -a && source .env && set +a
npm run dev                      # http://localhost:3000
```

## Before opening a pull request

```bash
npm run check                                                                    # TypeScript
TEST_DATABASE_URL=postgresql://linkfusion:linkfusion@localhost:5432/linkfusion npm test
npm run build
```

CI runs the same steps plus security scans (CodeQL, Trivy, Gitleaks, Checkov) and Terraform validation.

## Guidelines

- **Layers**: routes validate input and call services; services hold business rules; repositories hold all SQL. Keep each change in the layer it belongs to.
- **Validation**: add or extend schemas in `shared/api.ts`; the client and server share them.
- **Security**: treat every input as untrusted, never log secrets or request bodies, and keep ownership checks in SQL.
- **Tests**: add a test for every bug fix and feature (`tests/server/`).
- **Database changes**: edit `shared/schema.ts`, then `npm run db:generate` and commit the new file in `migrations/`.
- **Commits**: small and focused, with messages in the imperative ("Add …", "Fix …").

## Reporting security issues

Please report privately. See [SECURITY.md](SECURITY.md).
