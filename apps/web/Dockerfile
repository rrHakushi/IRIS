# ==========================================
# Base Stage
# ==========================================
FROM oven/bun:latest AS base

# Shim npm/npx to bun for tools (e.g. Next.js) expecting them in PATH
RUN printf '#!/bin/sh\nexec bun "$@"\n' > /usr/local/bin/npm && chmod +x /usr/local/bin/npm && \
    printf '#!/bin/sh\nexec bun x "$@"\n' > /usr/local/bin/npx && chmod +x /usr/local/bin/npx


# ==========================================
# Prune Stage (Turborepo)
# ==========================================
FROM base AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune web --docker --use-gitignore=false

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder
WORKDIR /app

# First copy lockfile and package specs to cache dependencies layer
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile

# Copy full pruned source code and build Next.js application
COPY --from=pruner /app/out/full/ .
ARG NEXT_PUBLIC_API_URL=https://api.runerra.org
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun x turbo run build --filter=web

# ==========================================
# Production Runner Stage
# ==========================================
FROM oven/bun:latest AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run container as unprivileged user
RUN groupadd --system --gid 1001 nextjs && \
    useradd --system --uid 1001 -g nextjs nextjs

# Copy Next.js standalone output, public directory, and static assets
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static

# Pre-create image cache directory with appropriate ownership
RUN mkdir -p ./apps/web/.next/cache/images && chown -R nextjs:nextjs ./apps/web/.next/cache

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e 'fetch("http://localhost:" + (Bun.env.PORT || 3000) + "/").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

CMD ["bun", "apps/web/server.js"]
