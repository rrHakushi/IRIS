# ==========================================
# Base Stage
# ==========================================
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ==========================================
# Prune Stage (Turborepo)
# ==========================================
FROM base AS pruner
RUN apk add --no-cache libc6-compat nodejs npm
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @IRIS/elysia --docker --use-gitignore=false

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies from lockfile
COPY --from=pruner /app/out/json/ .
RUN bun install

# Copy full source and build
COPY --from=pruner /app/out/full/ .
RUN bun --filter @IRIS/elysia run build || true

# ==========================================
# Production Runner Stage
# ==========================================
FROM base AS runner
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Run as non-root unprivileged bun user
USER bun

COPY --from=builder --chown=bun:bun /app ./

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-4000}/health || exit 1

CMD ["bun", "run", "apps/elysia/src/index.ts"]
