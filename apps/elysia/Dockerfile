# ==========================================
# Prune Stage (Turborepo)
# ==========================================
FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @IRIS/elysia --docker --use-gitignore=false

# ==========================================
# Builder Stage (pnpm install + bun compile)
# ==========================================
FROM oven/bun:latest AS builder
WORKDIR /app

# Enable pnpm in bun image
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm && \
    npm install -g pnpm@12.5.1 && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies using pnpm and pnpm-lock.yaml (NO bun install)
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy full source and compile standalone binary with Bun
COPY --from=pruner /app/out/full/ .
WORKDIR /app/apps/elysia

ENV NODE_ENV=production

RUN bun run codegen && \
    bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --outfile server \
    src/index.ts

# ==========================================
# Runner Stage (Distroless)
# ==========================================
FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=builder /app/apps/elysia/server server

ENV NODE_ENV=production

CMD ["./server"]

EXPOSE 4000