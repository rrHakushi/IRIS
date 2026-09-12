# Developer Guide: Implementing IRIS OAuth 2.0 & OpenID Connect in Any Application

This guide provides everything you need to implement **Sign in with IRIS** and consume protected IRIS APIs in any external application — whether it is a web app, single-page application (SPA), mobile app, desktop client, Discord bot, or CLI tool.

---

## 1. Overview & Protocol Endpoints

IRIS implements standard **OAuth 2.0 (RFC 6749)** with **PKCE (RFC 7636)** and **OpenID Connect (OIDC) Core 1.0**.

### Well-Known Discovery Endpoints
Your application can automatically discover all endpoints and capabilities by querying the standard OpenID Connect discovery metadata:

```http
GET https://<iris-instance-url>/.well-known/openid-configuration
GET https://<iris-instance-url>/.well-known/oauth-authorization-server
```

### Core OAuth Endpoints
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/oauth/authorize` | `GET`, `POST` | User consent screen and authorization code issuance. |
| `/oauth/token` | `POST` | Exchange code for tokens, refresh tokens, or client credentials. |
| `/oauth/userinfo` | `GET` | Retrieve authenticated user identity and profile claims. |
| `/oauth/revoke` | `POST` | Revoke active access or refresh tokens (RFC 7009). |
| `/oauth/introspect` | `POST` | Query active status and metadata of a token (RFC 7662). |
| `/oauth/register` | `POST` | RFC 7591 Dynamic Client Registration for automated setup. |

---

## 2. Registering Your Application

Before authenticating users, you must register your application to obtain a `client_id` (and optionally a `client_secret`).

### Method A: Via the IRIS Web UI (Recommended)
1. Open IRIS and navigate to **Settings** (gear icon) > **Account** > **OAuth Apps**.
2. Click **Create Application**.
3. Fill in the details:
   - **Application Name**: Your app name (e.g. `My Desktop Player`).
   - **Description**: Short explanation shown to users on the consent screen.
   - **Redirect URIs**: One or more callback URLs (e.g. `http://localhost:3000/api/auth/callback/iris` or `myapp://oauth/callback`).
   - **Allowed Scopes**: Select the permissions your application requires.
   - **Public Client**: Check this if your app cannot securely store secrets (SPAs, mobile apps, desktop apps, CLI tools).
4. Click **Create Application**.
5. Save the generated **Client ID** and **Client Secret** (the secret is shown only once).

### Method B: Via RFC 7591 Dynamic Client Registration
If your application or instance needs to register programmatically:

```http
POST https://<iris-instance-url>/oauth/register
Content-Type: application/json

{
  "client_name": "My External App",
  "redirect_uris": ["https://myapp.com/callback"],
  "scope": "identify profile lists:read",
  "token_endpoint_auth_method": "none" // Or "client_secret_post" for confidential apps
}
```

Response:
```json
{
  "client_id": "iris_client_a1b2c3d4...",
  "client_secret": "iris_sec_e5f6g7h8...",
  "client_name": "My External App",
  "redirect_uris": ["https://myapp.com/callback"]
}
```

---

## 3. Scopes & Permissions

Request only the minimum scopes necessary for your application:

| Scope | Name | Risk Level | Description |
| :--- | :--- | :--- | :--- |
| `identify` | Basic Identity | Safe | Access username, user ID, and avatar URL. |
| `profile` | User Profile | Safe | Access full profile bio, banner, and customization preferences. |
| `email` | Primary Email | Sensitive | Access the user's verified primary email address. |
| `lists:read` | Read Media Lists | Safe | Read anime, manga, movie, TV, game, book, and music lists. |
| `lists:write` | Manage Media Lists | Elevated | Add, update progress/status/score, or delete list entries. |
| `activity:read` | Read Activity Feed | Safe | View recent activity timeline, scrobbles, and history. |
| `activity:write` | Scrobble & Post | Elevated | Scrobble playback and publish activity updates. |
| `offline_access` | Offline Access | Sensitive | Issue a `refresh_token` for persistent background access. |

---

## 4. The Authorization Flow (with PKCE)

All clients — whether public or confidential — should use the **Authorization Code Flow with PKCE (Proof Key for Code Exchange)** for maximum security.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant App as Your Application
    participant IRIS as IRIS OAuth Server

    App->>App: 1. Generate code_verifier & code_challenge (S256)
    App->>User: 2. Redirect to /oauth/authorize
    User->>IRIS: 3. View consent screen & approve permissions
    IRIS-->>App: 4. Redirect to redirect_uri with ?code=...&state=...
    App->>IRIS: 5. POST /oauth/token (code + code_verifier)
    IRIS-->>App: 6. Return access_token & refresh_token
    App->>IRIS: 7. GET /oauth/userinfo (Bearer <access_token>)
    IRIS-->>App: 8. Return user profile JSON
```

### Step 1: Generate PKCE Verifier & Challenge

1. Generate a high-entropy cryptographic random string between 43 and 128 characters (`code_verifier`).
2. Calculate the SHA-256 hash of the `code_verifier`.
3. Base64url-encode the resulting hash without padding (`code_challenge`).

### Step 2: Redirect User to Authorize

Construct the authorization URL and redirect the user:

```
https://<iris-instance-url>/oauth/authorize?
  response_type=code&
  client_id=<YOUR_CLIENT_ID>&
  redirect_uri=<YOUR_ENCODED_REDIRECT_URI>&
  scope=identify%20profile%20lists:read%20offline_access&
  state=<SECURE_RANDOM_STATE>&
  code_challenge=<BASE64URL_SHA256_CHALLENGE>&
  code_challenge_method=S256
```

Parameters:
- `response_type`: Must be `code`.
- `client_id`: The client ID issued during registration.
- `redirect_uri`: One of your registered callback URLs.
- `scope`: Space-separated list of scopes.
- `state`: Cryptographically random string to prevent CSRF attacks.
- `code_challenge`: The base64url-encoded SHA-256 hash from Step 1.
- `code_challenge_method`: Must be `S256`.

### Step 3: Handle Callback & Exchange Code for Tokens

When the user approves, IRIS redirects back to your `redirect_uri`:

```
https://myapp.com/callback?code=iris_code_12345...&state=<STATE>
```

Verify that the returned `state` matches what you generated in Step 2. Then make a `POST` request to `/oauth/token`:

```http
POST https://<iris-instance-url>/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "<YOUR_CLIENT_ID>",
  "client_secret": "<YOUR_CLIENT_SECRET>", // Omit for public clients (SPAs/mobile)
  "code": "iris_code_12345...",
  "redirect_uri": "https://myapp.com/callback",
  "code_verifier": "<ORIGINAL_UNHASHED_CODE_VERIFIER>"
}
```

Response (`200 OK`):
```json
{
  "token_type": "Bearer",
  "access_token": "iris_at_994a5a589be7...",
  "expires_in": 2592000,
  "refresh_token": "iris_rt_8e4a91b2c4d5...",
  "scope": "identify profile lists:read offline_access"
}
```

### Step 4: Fetch User Profile (`/oauth/userinfo`)

Use the returned `access_token` in the `Authorization` header:

```http
GET https://<iris-instance-url>/oauth/userinfo
Authorization: Bearer iris_at_994a5a589be7...
```

Response (`200 OK`):
```json
{
  "sub": "usr_c83f98a2-...",
  "id": "usr_c83f98a2-...",
  "username": "cosmic_voyager",
  "name": "Cosmic Voyager",
  "email": "voyager@iris.app",
  "email_verified": true,
  "avatarUrl": "https://cdn.iris.app/avatars/cosmic.png",
  "picture": "https://cdn.iris.app/avatars/cosmic.png",
  "profileUrl": "https://iris.example.com/users/cosmic_voyager"
}
```

### Step 5: Refreshing Expired Tokens

When an access token expires (or after `expires_in` seconds), exchange the `refresh_token` for a fresh token pair:

```http
POST https://<iris-instance-url>/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "client_id": "<YOUR_CLIENT_ID>",
  "client_secret": "<YOUR_CLIENT_SECRET>", // If confidential client
  "refresh_token": "iris_rt_8e4a91b2c4d5..."
}
```

Response (`200 OK`):
```json
{
  "token_type": "Bearer",
  "access_token": "iris_at_new_token_string...",
  "expires_in": 2592000,
  "refresh_token": "iris_rt_new_refresh_string...",
  "scope": "identify profile lists:read offline_access"
}
```

### Step 6: Revoking Access (`/oauth/revoke`)

When a user logs out or unlinks their account:

```http
POST https://<iris-instance-url>/oauth/revoke
Content-Type: application/json

{
  "token": "iris_at_... (or refresh token)",
  "token_type_hint": "access_token",
  "client_id": "<YOUR_CLIENT_ID>",
  "client_secret": "<YOUR_CLIENT_SECRET>"
}
```

---

## 5. Integration Code Examples

### A. NextAuth.js / Auth.js (Next.js App Router)

You can integrate IRIS into any Next.js app using a custom OAuth provider:

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"

const IRIS_URL = process.env.IRIS_URL || "https://iris.example.com"

export const authOptions = {
  providers: [
    {
      id: "iris",
      name: "IRIS",
      type: "oauth",
      wellKnown: `${IRIS_URL}/.well-known/openid-configuration`,
      authorization: {
        params: {
          scope: "identify profile email lists:read offline_access",
        },
      },
      clientId: process.env.IRIS_CLIENT_ID!,
      clientSecret: process.env.IRIS_CLIENT_SECRET!,
      checks: ["pkce", "state"],
      profile(profile: any) {
        return {
          id: profile.sub || profile.id,
          name: profile.name || profile.username,
          email: profile.email,
          image: profile.avatarUrl || profile.picture,
        }
      },
    },
  ],
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

#### Triggering Sign In from the Client
Always initiate sign in with `signIn("iris")` from `next-auth/react`:

```tsx
"use client"
import { signIn } from "next-auth/react"

export function LoginButton() {
  return (
    <button onClick={() => signIn("iris", { callbackUrl: "/dashboard" })}>
      Sign in with IRIS
    </button>
  )
}
```

> [!WARNING]
> **Common Gotcha: `Error: This action with HTTP GET is not supported by NextAuth.js`**
> NextAuth intentionally rejects direct `GET` requests to `/api/auth/signin/[provider]` to prevent CSRF login attacks.
> - **Never** use plain HTML links like `<a href="/api/auth/signin/iris">`. Always use `signIn("iris")` or a `<form method="POST" action="/api/auth/signin/iris">` with a CSRF token.
> - **Ensure your registered redirect URI** in IRIS is `https://<your-app>/api/auth/callback/iris` (notice `callback`, not `signin`).

---

### B. Node.js / TypeScript (Zero External OAuth Dependencies)

```typescript
import { createHash, randomBytes } from "node:crypto"

const IRIS_HOST = "https://iris.example.com"
const CLIENT_ID = process.env.IRIS_CLIENT_ID!
const CLIENT_SECRET = process.env.IRIS_CLIENT_SECRET!
const REDIRECT_URI = "http://localhost:3000/auth/callback"

// Helper: Generate PKCE S256 pair
export function generatePkce() {
  const codeVerifier = randomBytes(32).toString("base64url")
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url")
  return { codeVerifier, codeChallenge }
}

// 1. Build Authorization URL
export function getAuthorizationUrl(state: string, codeChallenge: string) {
  const url = new URL(`${IRIS_HOST}/oauth/authorize`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", CLIENT_ID)
  url.searchParams.set("redirect_uri", REDIRECT_URI)
  url.searchParams.set("scope", "identify profile email lists:read offline_access")
  url.searchParams.set("state", state)
  url.searchParams.set("code_challenge", codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")
  return url.toString()
}

// 2. Exchange code for tokens
export async function exchangeCode(code: string, codeVerifier: string) {
  const res = await fetch(`${IRIS_HOST}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`)
  }

  return (await res.json()) as {
    access_token: string
    refresh_token?: string
    token_type: string
    expires_in: number
  }
}

// 3. Fetch User Info
export async function getUserProfile(accessToken: string) {
  const res = await fetch(`${IRIS_HOST}/oauth/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch userinfo: ${await res.text()}`)
  }

  return await res.json()
}
```

---

### C. Python (FastAPI / Requests / Authlib)

```python
import base64
import hashlib
import secrets
import requests

IRIS_HOST = "https://iris.example.com"
CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
REDIRECT_URI = "https://myapp.com/callback"

def generate_pkce():
    code_verifier = secrets.token_urlsafe(64)
    hashed = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(hashed).decode("ascii").rstrip("=")
    return code_verifier, code_challenge

# 1. Build Login URL
def get_auth_url(state: str, code_challenge: str) -> str:
    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "identify profile lists:read offline_access",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    req = requests.Request("GET", f"{IRIS_HOST}/oauth/authorize", params=params)
    return req.prepare().url

# 2. Exchange Code
def exchange_code(code: str, code_verifier: str) -> dict:
    resp = requests.post(
        f"{IRIS_HOST}/oauth/token",
        json={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": code_verifier,
        },
    )
    resp.raise_for_status()
    return resp.json()

# 3. Get User Profile
def get_user_info(access_token: str) -> dict:
    resp = requests.get(
        f"{IRIS_HOST}/oauth/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    resp.raise_for_status()
    return resp.json()
```

---

### D. Single-Page Application (SPA / React / Browser)

Public clients do not store a `client_secret`. Use the Web Crypto API for PKCE:

```typescript
// Generate PKCE code verifier and challenge in the browser
async function generatePkce() {
  const array = new Uint8Array(32)
  window.crypto.getRandomValues(array)
  const codeVerifier = Array.from(array, (dec) => dec.toString(16).padStart(2, "0")).join("")

  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await window.crypto.subtle.digest("SHA-256", data)
  
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  return { codeVerifier, codeChallenge }
}

// Redirect to login
async function loginWithIris() {
  const { codeVerifier, codeChallenge } = await generatePkce()
  sessionStorage.setItem("pkce_verifier", codeVerifier)

  const params = new URLSearchParams({
    response_type: "code",
    client_id: "your_public_client_id",
    redirect_uri: window.location.origin + "/callback",
    scope: "identify profile lists:read",
    state: crypto.randomUUID(),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  window.location.href = `https://iris.example.com/oauth/authorize?${params.toString()}`
}

// Exchange code at callback page
async function handleCallback(code: string) {
  const codeVerifier = sessionStorage.getItem("pkce_verifier")
  if (!codeVerifier) throw new Error("Missing PKCE verifier")

  const res = await fetch("https://iris.example.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: "your_public_client_id",
      code,
      redirect_uri: window.location.origin + "/callback",
      code_verifier: codeVerifier,
    }),
  })

  const tokens = await res.json()
  sessionStorage.removeItem("pkce_verifier")
  return tokens
}
```

---

### E. CLI / Desktop App / Shell (cURL)

```bash
# 1. Step 1: Compute code challenge for verifier "my_very_long_secure_verifier_12345678901234567890"
# (Use any S256 tool or python snippet)

# 2. Step 2: Open browser to consent page
# https://iris.example.com/oauth/authorize?response_type=code&client_id=my_client&redirect_uri=http://localhost:8080&scope=identify&code_challenge=...&code_challenge_method=S256

# 3. Step 3: Exchange received authorization code
curl -X POST https://iris.example.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "client_id": "my_client",
    "code": "received_auth_code",
    "redirect_uri": "http://localhost:8080",
    "code_verifier": "my_very_long_secure_verifier_12345678901234567890"
  }'

# 4. Step 4: Use access token
curl https://iris.example.com/oauth/userinfo \
  -H "Authorization: Bearer iris_at_..."
```

---

## 6. IRIS-to-IRIS Federation

If you are running another IRIS instance and wish to link accounts across instances:

1. Navigate to **Settings** > **Account** > **Connections**.
2. Find the **IRIS** connection card and click **Connect**.
3. Enter the URL of the remote IRIS instance (e.g. `https://iris.friends-server.com`).
4. Click **Authorize with IRIS**.
5. You will be redirected to the remote instance to approve permissions.
6. Once approved, media lists and user profile links will synchronize bidirectionally via `@IRIS/connections`.

---

## 7. Security Best Practices & Troubleshooting

1. **Always Use PKCE**: Even confidential server clients should use PKCE to defend against code injection and authorization code interception attacks.
2. **Single-Use Authorization Codes**: Authorization codes expire after 10 minutes and can only be used once. Attempting to use a code more than once triggers immediate revocation of all tokens previously issued to that authorization session.
3. **Validate Redirect URIs**: Ensure your callback URL matches one of your registered URIs verbatim (including protocol and port).
4. **Token Storage**: Never store client secrets or refresh tokens in local storage on public web clients.
5. **Handling 401 Unauthorized**: If an API request returns `401 Unauthorized`, attempt a token refresh using the `refresh_token`. If the refresh fails with `invalid_grant`, redirect the user to re-authenticate.
