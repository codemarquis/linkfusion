# Google and GitHub sign-in

Both are optional. A provider is enabled when both its client ID and secret are set; its button then appears on the sign-in and sign-up pages.

Callback URLs are built from `PUBLIC_BASE_URL`:

| Provider | Callback URL |
|---|---|
| Google | `<PUBLIC_BASE_URL>/api/auth/google/callback` |
| GitHub | `<PUBLIC_BASE_URL>/api/auth/github/callback` |

For local development with `PUBLIC_BASE_URL=http://localhost:3000`, register `http://localhost:3000/api/auth/google/callback` (and the GitHub equivalent).

## Google

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID** (type *Web application*).
2. Add the callback URL under **Authorized redirect URIs**.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## GitHub

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Homepage URL: your `PUBLIC_BASE_URL`; Authorization callback URL: the callback above.
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

## How accounts are matched

- A returning user is recognised by the provider's account ID.
- A first-time OAuth sign-in is linked to an existing account with the same email **only if the provider reports that email as verified** (GitHub: the primary email from `/user/emails`). Otherwise sign-in is refused, so nobody can take over an account by adding someone else's unverified email to their Google/GitHub account.
- The OAuth `state` parameter protects the callback against CSRF.

In production, secrets come from AWS Secrets Manager (see [deployment.md](deployment.md)).
