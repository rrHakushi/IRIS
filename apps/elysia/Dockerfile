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

ENV BUN_ENV=production

RUN --mount=type=secret,id=app_env,target=/app/.env \
    set -a && . /app/.env && set +a && \
    bun run codegen && \
    bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --outfile server \
    src/index.ts

# ==========================================
# Runner Stage (Distroless Non-Root)
# ==========================================
FROM gcr.io/distroless/base-debian12:nonroot

WORKDIR /app

ARG APP_VERSION
LABEL org.opencontainers.image.title="NamelessLiberty-Elysia" \
      org.opencontainers.image.version="${APP_VERSION}"

COPY --from=pruner --chown=nonroot:nonroot /app/out/json/apps/elysia/package.json ./package.json
COPY --from=builder --chown=nonroot:nonroot /app/apps/elysia/server ./server

ENV BUN_ENV=production
ENV APP_VERSION=${APP_VERSION}

USER nonroot:nonroot

CMD ["./server"]

EXPOSE 4000
