# Google, Apple and GitHub sign-in

All three are optional. The sign-in and sign-up pages always show the three buttons; a provider's button becomes active once its settings are present, and stays disabled (with a hint) until then.

Callback URLs are built from `PUBLIC_BASE_URL`:

| Provider | Callback URL |
|---|---|
| Google | `<PUBLIC_BASE_URL>/api/auth/google/callback` |
| GitHub | `<PUBLIC_BASE_URL>/api/auth/github/callback` |
| Apple | `<PUBLIC_BASE_URL>/api/auth/apple/callback` (HTTPS only; Apple rejects `localhost`) |

For local development with `PUBLIC_BASE_URL=http://localhost:3000`, register `http://localhost:3000/api/auth/google/callback` (and the GitHub equivalent).

## Google

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID** (type *Web application*).
2. Add the callback URL under **Authorized redirect URIs**.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## GitHub

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Homepage URL: your `PUBLIC_BASE_URL`; Authorization callback URL: the callback above.
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

## Apple

Needs a paid Apple Developer account.

1. **Certificates, Identifiers & Profiles → Identifiers**: create an *App ID* with **Sign in with Apple** enabled.
2. Create a **Services ID** (e.g. `com.example.linkfusion.web`), enable **Sign in with Apple**, and under *Configure* add your domain and the callback URL above. This Services ID is your `APPLE_CLIENT_ID`.
3. **Keys → +**: create a key with **Sign in with Apple** enabled, linked to the App ID. Download the `.p8` file (you only get one chance) and note its **Key ID**.
4. Set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID` (top right of the developer portal), `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` (the `.p8` contents; in a one-line `.env`, write the newlines as `\n`).

How it's secured:

- Apple returns users with a cross-site **form POST**, which a `SameSite=Lax` session cookie doesn't survive. So the flow is bound to the browser by a separate `__Secure-` cookie (HttpOnly, `SameSite=None`, scoped to `/api/auth/apple`, 10-minute lifetime) holding a random `state`. The callback is the single route exempt from the same-origin check, and it rejects any request whose `state` doesn't match that cookie (constant-time comparison).
- The ID token's `nonce` must equal `SHA-256(state)`, which prevents token replay and injection.
- The ID token is fetched server-to-server with a client secret (an ES256 JWT signed with your `.p8` key and valid for 5 minutes), then verified against Apple's published keys for signature, issuer, audience and expiry.
- Users can hide their email behind Apple's private relay (`…@privaterelay.appleid.com`). That address is verified and works like any other; mail you send reaches them only if you register your sending domain with Apple.
- Apple sends the user's name only on the first sign-in. LinkFusion saves it then.

## How accounts are matched

- A returning user is recognised by the provider's account ID.
- A first-time OAuth sign-in is linked to an existing account with the same email **only if the provider reports that email as verified** (GitHub: the primary email from `/user/emails`). Otherwise sign-in is refused, so nobody can take over an account by adding someone else's unverified email to their Google/GitHub/Apple account.
- The OAuth `state` parameter protects every callback against CSRF.

In production, secrets come from AWS Secrets Manager (see [deployment.md](deployment.md)).
