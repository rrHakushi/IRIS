# ==========================================
# Base Stage
# ==========================================
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ==========================================
# Prune Stage (Turborepo)
# ==========================================
FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @IRIS/server --docker

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# First copy lockfile and package specs to cache dependencies layer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy full pruned source code and compile
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @IRIS/server build

# ==========================================
# Production Runner Stage
# ==========================================
FROM base AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Run container as unprivileged user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app ./

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4000}/ || exit 1

CMD ["node", "apps/server/dist/main.js"]
