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
RUN turbo prune web --docker --use-gitignore=false

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# First copy lockfile and package specs to cache dependencies layer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy full pruned source code and build Next.js application
COPY --from=pruner /app/out/full/ .
ARG NEXT_PUBLIC_API_URL=https://api.runerra.org
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter web build

# ==========================================
# Production Runner Stage
# ==========================================
FROM base AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run container as unprivileged user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/ || exit 1

CMD ["node", "apps/web/server.js"]
