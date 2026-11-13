# Getting Started — NamelessLiberty Infrastructure & Deployment

This guide covers setting up the **NamelessLiberty** Docker Compose stack, configuring **Infisical** for multi-environment secret management (`prod`, `dev-1`, `dev-2`), and wiring **Drone CI** for automated deployments.

---

## 1. Container & Port Reference

All containers run on the isolated `NamelessLiberty` bridge network (`180.0.0.0/24`, gateway `180.0.0.1`) and expose dedicated `10000+` host ports:

| Container Name | Service | Internal IP | Host Port | Container Port | Volume Mounts |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NamelessLiberty-Postgre` | `postgre` | `180.0.0.2` | `10001` | `5432` | `~/db-data/postgres:/var/lib/postgresql` |
| `NamelessLiberty-Redis` | `redis` | `180.0.0.3` | `10002` | `6379` | `NamelessLiberty-redis-data:/data` |
| `NamelessLiberty-Infisical` | `infisical` | `180.0.0.7` | `10003` | `8080` | `NamelessLiberty-infisical-data:/app/data` |
| `NamelessLiberty-RustFS` | `rustfs` | `180.0.0.4` | `10004` (API)<br>`10005` (UI) | `9000`<br>`9001` | `/mnt/wdext/rustfs/data:/data`<br>`NamelessLiberty-rustfs-logs:/app/logs` |
| `NamelessLiberty-Deemix` | `deemix` | `180.0.0.5` | `10006` | `6595` | `/mnt/wdext/media/music:/downloads`<br>`NamelessLiberty-deemix-config:/config` |
| `NamelessLiberty-SearXNG` | `searxng` | `180.0.0.6` | `10007` | `8080` | `./core-config/:/etc/searxng/:Z`<br>`NamelessLiberty-searxng-cache:/var/cache/searxng/` |
| `NamelessLiberty-Elysia` | `elysia` | `180.0.0.8` | `10008` | `4000` | Read-only rootfs (`/tmp` tmpfs) |
| `NamelessLiberty-Next` | `next` | `180.0.0.9` | `10009` | `3000` | `/tmp` tmpfs |

---

## 2. Host Directory Preparation

Before starting the stack on the host machine for the first time, ensure the host bind-mount directories exist and have appropriate permissions:

```bash
mkdir -p ~/db-data/postgres
sudo mkdir -p /mnt/wdext/rustfs/data /mnt/wdext/media/music
# RustFS runs as UID/GID 10001 inside the container
sudo chown -R 10001:10001 /mnt/wdext/rustfs/data
```

---

## 3. First-Time Infisical Bootstrap & Project Setup

Infisical uses `NamelessLiberty-Postgre` (automatically creating a dedicated `infisical` database via the Postgres healthcheck) and `NamelessLiberty-Redis`.

### Step 3.1: Generate Infisical Master Keys

Run these commands once to generate your Infisical encryption and auth secrets:

```bash
# 1. Generate INFISICAL_ENCRYPTION_KEY (32-char hex)
openssl rand -hex 16

# 2. Generate INFISICAL_AUTH_SECRET (32-byte base64)
openssl rand -base64 32
```

### Step 3.2: Boot Postgres, Redis, and Infisical

Create a temporary `.env` with the bootstrap credentials to start Infisical for the first time:

```bash
cat << 'EOF' > .env
POSTGRE_USER=postgres
POSTGRE_PASS=your_strong_postgres_password
POSTGRE_DB=iris
REDIS_PASSWORD=your_strong_redis_password
INFISICAL_ENCRYPTION_KEY=paste_hex_key_here
INFISICAL_AUTH_SECRET=paste_base64_secret_here
INFISICAL_SITE_URL=http://localhost:10003
EOF

chmod 600 .env
docker compose up -d redis postgre infisical
```

### Step 3.3: Create Your Project & Environments (`1 prod`, `2 dev`)

1. Open the Infisical web UI at `http://<server-ip>:10003` and create your admin account.
2. Click **Create Project** and name it **NamelessLiberty**.
3. Go to **Project Settings → General** and copy the **Project ID** — this single ID is your `INFISICAL_PROJECT_ID` across all environments (`prod` and `dev`).
4. Still in **Project Settings**, open the **Environments** tab to configure your 1 production and 2 development environments inside the same project:
   - Keep **Production** (slug: `prod`)
   - Keep/rename **Development 1** (slug: `dev` or `dev-1`)
   - Click **Create Environment** to add **Development 2** (slug: `dev-2`)

### Step 3.4: Create `INFISICAL_TOKEN` for Drone CI

1. Inside your **NamelessLiberty** project in Infisical, go to **Project Settings → Access Control → Service Tokens**.
2. Click **Create Token**:
   - **Name**: `Drone-CI`
   - **Environment**: `Production` (`prod`)
   - **Secret Path**: `/`
   - **Expiration**: `Never`
   - **Permissions**: `Read`
3. Copy the generated token (`st.xxx.yyy.zzz`) — this is your `INFISICAL_TOKEN` in Drone.

---

## 4. Drone CI Secrets

Add only these **9 secrets** in your Drone repository settings. Everything else is pulled dynamically from Infisical during the `Environment` step:

| Drone Secret Name | Value / Source |
| :--- | :--- |
| `REDIS_PASSWORD` | Redis password for `NamelessLiberty-Redis` |
| `POSTGRE_USER` | Postgres user for `NamelessLiberty-Postgre` |
| `POSTGRE_PASS` | Postgres password for `NamelessLiberty-Postgre` |
| `POSTGRE_DB` | Primary IRIS database name (e.g. `iris`) |
| `INFISICAL_ENCRYPTION_KEY` | Output of `openssl rand -hex 16` |
| `INFISICAL_AUTH_SECRET` | Output of `openssl rand -base64 32` |
| `INFISICAL_SITE_URL` | Public or internal URL of Infisical (e.g. `http://localhost:10003`) |
| `INFISICAL_PROJECT_ID` | Copied from Infisical **Project Settings → General → Project ID** |
| `INFISICAL_TOKEN` | Service token (`st.xxx...`) created in Infisical for `prod` |
| `github_token` | GitHub PAT with `repo` scope for publishing JellyBorealis & BorealisExtra releases |

---

## 5. Secrets to Add Inside Infisical

Populate the following keys inside your Infisical project (`prod` environment for Docker deployment, and `dev-1` / `dev-2` for local development):

```dotenv
# Runtime & Telemetry
BUN_ENV=production
DO_NOT_TRACK=1
NEXT_TELEMETRY_DISABLED=1
TURBO_TELEMETRY_DISABLED=1
LOG_FORMAT=json
LOG_LEVEL=info

# Elysia & Next
ELYSIA_PORT=4000
ELYSIA_URL=http://elysia:4000
CLUSTER=true
CLUSTER_WORKERS=4
JWT_SECRET=

# PostgreSQL (inside Docker network use host `postgre` and port `5432`; for local dev use `localhost` and `10001`)
POSTGRE_HOST=postgre
POSTGRE_PORT=5432
POSTGRE_USER=postgres
POSTGRE_PASS=
POSTGRE_DB=iris

# Redis & Cache (inside Docker network use host `redis` and port `6379`; for local dev use `localhost` and `10002`)
CACHE_DRIVER=redis
CACHE_DEFAULT_TTL=300
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false

# RustFS S3 Storage (inside Docker network use `http://rustfs:9000`; for local dev use `http://localhost:10004`)
RUSTFS_URL=http://rustfs:9000
RUSTFS_REGION=us-east-1
RUSTFS_ACCESS_KEY=
RUSTFS_SECRET_KEY=
RUSTFS_PUBLIC_BUCKET=iris-public
RUSTFS_ENCRYPTED_BUCKET=iris-encrypted

# SearXNG (inside Docker network use `http://searxng:8080`; for local dev use `http://localhost:10007`)
SEARXNG_URL=http://searxng:8080

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SEND_EMAIL_IN_DEV=false

# Lynx Bot
LYNX_API_PORT=
LYNX_API_URL=
LYNX_DEV_SERVER=
LYNX_OWNER=
LYNX_TOKEN=

# OAuth & External Providers
IRIS_CLIENT_ID=
IRIS_CLIENT_SECRET=
ANIDB_CLIENT=
ANIDB_CLIENT_VER=
ANILIST_CLIENT_ID=
ANILIST_CLIENT_SECRET=
BANGUMI_CLIENT_ID=
BANGUMI_CLIENT_SECRET=
DEEZER_APP_ID=
DEEZER_APP_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
GOOGLE_BOOKS_API_KEY=
HIKKA_CLIENT_ID=
HIKKA_CLIENT_SECRET=
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
KLIPY_KEY=
LASTFM_API_KEY=
LASTFM_API_SECRET=
MAL_CLIENT_ID=
MAL_CLIENT_SECRET=
MAL_CODE_CHALLANGE_STRING=
MANGABAKA_CLIENT_ID=
MANGABAKA_CLIENT_SECRET=
RIOT_API_KEY=
RIOT_CLIENT_ID=
RIOT_CLIENT_SECRET=
SIMKL_CLIENT_ID=
SIMKL_CLIENT_SECRET=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
STEAM_API_KEY=
TVDB_API_KEY=
TRAKT_CLIENT_ID=
TRAKT_CLIENT_SECRET=
```

---

## 6. Local Development with Infisical Secrets

All `dev`, `codegen`, and `db:*` scripts have been updated to automatically use `infisical run --env=dev -- ...`.

### Step 1: Install Infisical CLI on Windows

Run this in your PowerShell terminal to install the native CLI:

```powershell
winget install infisical
```

*(Restart your PowerShell window after running `winget install` so `infisical` is in your `PATH`)*.

Verify installation:
```powershell
infisical --version
```

### Step 2: Login and Link to your Self-Hosted Instance (One-Time)

1. Log in pointing to your container's port (`10003`):
   ```bash
   infisical login --domain="http://<server-ip>:10003/api"
   ```
2. Link the repository to your Infisical project:
   ```bash
   infisical init
   ```
   Select your **NamelessLiberty** project when prompted.

### Step 3: Run Scripts Directly

Now you can run standard scripts, and secrets are dynamically pulled from the `dev` environment:

```bash
# Run entire monorepo in dev mode with Infisical secrets:
bun run dev

# Database tasks (automatically injected with dev secrets):
bun run db:update
bun run db:contract:emit

# Individual app dev:
bun run elysia:dev
```

If you ever want to run against a different environment slug (such as `dev-2` or `prod`), pass `--env=<slug>`:
```bash
infisical run --env=dev-2 -- turbo run dev
```

> **Note for Local DB / Services:**
> In your `dev-1` and `dev-2` environment in Infisical:
> - Set `POSTGRE_HOST=localhost` and `POSTGRE_PORT=10001` (to hit the Postgres container from your host).
> - Set `REDIS_HOST=localhost` and `REDIS_PORT=10002`.
> - Set `RUSTFS_URL=http://localhost:10004`.
> - Set `SEARXNG_URL=http://localhost:10007`.

---

## 7. Drone CI Pipeline Flow

On every push to `main`, `.drone.yml` executes the following 19 steps in order:

1. **Clone** — Fetches the latest commit from the repository.
2. **Redis** — Starts `NamelessLiberty-Redis` (`10002:6379`) and waits for healthcheck.
3. **Postgre** — Starts `NamelessLiberty-Postgre` (`10001:5432`), ensures the `infisical` database exists, and waits for healthcheck.
4. **infisical** — Starts `NamelessLiberty-Infisical` (`10003:8080`) backed by Postgres and Redis.
5. **Environment** — Exports all `prod` secrets from Infisical into `.env` (`chmod 600`) and runs `bun install --frozen-lockfile`.
6. **RustFS** — Starts `NamelessLiberty-RustFS` (`10004:9000`, `10005:9001`).
7. **deemix** — Starts `NamelessLiberty-Deemix` (`10006:6595`).
8. **searxng** — Starts `NamelessLiberty-SearXNG` (`10007:8080`).
9. **Prisma Contract** — Emits the Prisma 8 database contract (`@NamelessLiberty/db`).
10. **Prisma Update** — Pushes schema updates to `NamelessLiberty-Postgre`.
11. **Packages** — Builds all workspace packages (`./packages/*`).
12. **Elysia** — Compares `NamelessLiberty-Elysia`'s running version against `apps/elysia/package.json`; builds and recreates only if not running or outdated (`10008:4000`).
13. **Next** — Compares `NamelessLiberty-Next`'s running version against `apps/next/package.json`; builds and recreates only if not running or outdated (`10009:3000`).
14. **Jellyborealis - Build** — Builds the Jellyfin plugin release artifact.
15. **Jellyborealis - Release** — Publishes JellyBorealis to GitHub Releases.
16. **BorealisExtra - Build** — Builds Linux, Windows, and macOS BorealisExtra binaries.
17. **BorealisExtra - Release** — Publishes BorealisExtra binaries to GitHub Releases.
18. **Verify its running** — Verifies all 8 `NamelessLiberty-*` containers are running and prints logs.
19. **Cleanup** — Removes the temporary `.env` file from the runner workspace and prunes dangling Docker images.

