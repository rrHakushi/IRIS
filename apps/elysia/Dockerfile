# ==========================================
# Prune Stage (Turborepo)
# ==========================================
FROM oven/bun:latest AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune @IRIS/elysia --docker --use-gitignore=false

# ==========================================
# Builder Stage (bun install + bun compile)
# ==========================================
FROM oven/bun:latest AS builder
WORKDIR /app

# Install dependencies using Bun
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile

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