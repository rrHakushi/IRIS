---
name: IRIS-git
description: Official git commit message formatting and version control guide for the IRIS monorepo. Use whenever creating commits, drafting PR titles, writing commit descriptions, or preparing git changes. Enforces the "<App> | <Module> > <Action>" summary format and structured change documentation.
---

# IRIS Git Commit & Version Control Guide

This guide establishes the mandatory git commit formatting, description structure, and repository workflow standards across the **IRIS** monorepo.

---

## 1. Commit Title / Summary Format

Every commit title MUST adhere to the following standard:

```
<App> | <Module> > <What was changed>
```

When targeting a specific nested folder, feature sub-route, or sub-scope, use a forward slash (` / `):

```
<App> | <Module> / <Submodule> > <What was changed>
```

### Component Breakdown

| Segment | Description | Common Values / Examples |
|---|---|---|
| `<App>` | Application or workspace package | `Elysia`, `Web`, `Packages/<name>` (`Packages/database`, `Packages/cache`, `Packages/permissions`, `Packages/connections`), `Root`, `CI` |
| `<Module>` | Feature module or domain area | `IRIS-account`, `IRIS-media`, `IRIS-connections`, `IRIS-social`, `IRIS-list`, `Core`, `Schema`, `Config` |
| `<Submodule>` *(Optional)* | Sub-scope or nested feature directory | `Auth`, `TOTP`, `Passkeys`, `Anime`, `Search`, `Session`, `Mailer` |
| ` > ` | Fixed delimiter | Standard arrow separating module and action |
| `<What was changed>` | Clear, concise description of the change | Starts with a capital letter, describes the specific update or fix |

### Title Examples

- **Backend module fix**:
  `Elysia | IRIS-media > Fixed users anime list`
- **Backend nested feature**:
  `Elysia | IRIS-account / Auth > Added passkey login flow`
- **Frontend nested feature**:
  `Web | IRIS-account / Auth > Added passkey login flow`
- **Frontend page update**:
  `Web | Settings / Profile > Implemented avatar crop upload`
- **Database schema update**:
  `Packages/database | Schema > Added index on session token and user ID`
- **Shared package optimization**:
  `Packages/cache | Redis > Implemented automatic LRU memory fallback`
- **Root configuration**:
  `Root | CI / Drone > Optimized multi-stage Docker build caching`

---

## 2. Commit Description / Body Format

Every commit (or Pull Request description) must document the change using this exact three-section template:

```markdown
### What was changed
- Detailed technical description of code/configuration modified
- Added or updated files, routes, components, or migrations

### Why it was changed
- Motivation, business requirement, bug context, or design decision
- Why this particular solution was chosen

### What it fixed / improved
- Specific bugs resolved, performance enhancements, or user-facing improvements
- Error conditions now prevented
```

---

## 3. Complete Commit Message Examples

### Example 1: Backend Bug Fix

```
Elysia | IRIS-media > Fixed users anime list

### What was changed
- Corrected query filter in media route handler to properly join user library entries.
- Added validation for optional status and pagination query parameters.

### Why it was changed
- Requests for user media lists were omitting custom status categories due to an unhandled null constraint.

### What it fixed / improved
- Resolves 500 error when querying user lists with mixed status filters.
- Decreased query execution time by 15% via optimized database join.
```

### Example 2: Frontend Feature Addition

```
Web | IRIS-account / Auth > Added passkey login flow

### What was changed
- Integrated WebAuthn browser API client in authentication page.
- Created passkey prompt modal with fallback to standard email/password credentials.

### Why it was changed
- Provide modern passwordless authentication for biometric-enabled devices.

### What it fixed / improved
- Enables users with registered FIDO2 / TouchID devices to authenticate in one click.
- Improves login conversion and eliminates password recovery friction.
```

### Example 3: Database & Schema Migration

```
Packages/database | Schema > Added index on session token and user ID

### What was changed
- Created Prisma migration adding composite index on `(token, userId)` in the `Session` table.
- Regenerated Prisma client types.

### Why it was changed
- Session resolution plugin in Elysia was executing sequential scans on high-concurrency requests.

### What it fixed / improved
- Reduced session lookup latency from 24ms to under 1ms on authenticated routes.
```

---

## 4. Git Workflow & Monorepo Best Practices

1. **Atomic Commits**:
   - Keep commits focused on a single logical change. Do not combine unrelated refactors with bug fixes.
2. **Pre-Commit Verification**:
   - Before committing, ensure the workspace compiles cleanly:
     - `pnpm route:sync` (if route files were added/removed in Elysia)
     - `pnpm format`
     - `pnpm typecheck`
3. **Never Commit Secrets or Local Files**:
   - Never stage `.env`, `dev-account.json`, local database SQLite caches (`*.db`), or temporary build artifacts.
4. **Branch Naming Standard**:
   - `feat/<app>-<short-description>` (e.g., `feat/elysia-passkeys`)
   - `fix/<app>-<short-description>` (e.g., `fix/web-media-pagination`)
   - `refactor/<app>-<short-description>`
   - `docs/<topic>`
