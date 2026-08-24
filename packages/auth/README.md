# `@IRIS/auth`

Unified NextAuth authentication package for the IRIS ecosystem.

Provides credential authentication (Password, MFA, Passkey, Login Code) and OAuth identity providers (Google, Apple, Discord) with a streamlined JWT session architecture.

---

## 1. Features

- **Authentication Strategies**:
  - **Password**: Username or Email identifier + password.
  - **Multi-Factor Authentication (MFA)**: TOTP, Email verification code, and WebAuthn Passkeys.
  - **Passkey-Only**: Passwordless WebAuthn login.
  - **Quick-Connect Login Code**: Alphanumeric code or QR session authentication (Jellyfin/Discord style).
  - **OAuth 2.0**: Google, Apple, and Discord.
- **Lean Session Payload**: Exclusively stores `id`, `username`, `email`, and `passwordChangedAt`.
- **Automatic Token Invalidation**: Revokes JWT sessions when a user's password is changed.
- **Strict TypeScript Types**: Zero `any` or `unknown` types with `null`-only semantics.
- **Next.js Integration**: App Router route handler and `auth()` / `getServerAuthSession()` helpers.

---

## 2. Session Payload

```typescript
interface Session {
  user: {
    id: string;
    username: string;
    email: string;
    passwordChangedAt: number | null;
  };
  error: string | null;
}
```

---

## 3. Server Component Usage

```typescript
import { auth } from "@IRIS/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <h1>Welcome, {session.user.username}</h1>
      <p>Email: {session.user.email}</p>
    </div>
  );
}
```

---

## 4. Next.js Route Setup

In `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@IRIS/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

---

## 5. Environment Variables

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Canonical URL of the frontend application |
| `NEXTAUTH_SECRET` | Secret used to encrypt and sign JWT session tokens |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth Client Secret |
| `APPLE_ID` | Optional Apple OAuth Client ID |
| `APPLE_SECRET` | Optional Apple OAuth Client Secret |
| `DISCORD_CLIENT_ID` | Optional Discord OAuth Client ID |
| `DISCORD_CLIENT_SECRET` | Optional Discord OAuth Client Secret |
