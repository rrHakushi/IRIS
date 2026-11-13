# ==========================================
# Prune Stage (Turborepo)
# ==========================================
FROM oven/bun:latest AS pruner
WORKDIR /app
COPY . .
RUN bun x turbo prune @NamelessLiberty/elysia --docker --use-gitignore=false

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
RUN ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    bun -e "const r = await fetch('https://github.com/Infisical/cli/releases/download/v0.45.6/cli_0.45.6_linux_' + process.argv[1] + '.tar.gz'); if (!r.ok) throw new Error('Failed to download infisical CLI: ' + r.statusText); await Bun.write('/tmp/infisical.tar.gz', r);" "$ARCH" && \
    tar -xzf /tmp/infisical.tar.gz -C /usr/local/bin infisical && \
    rm -f /tmp/infisical.tar.gz
WORKDIR /app/apps/elysia

ARG INFISICAL_SITE_URL
ENV BUN_ENV=production
ENV INFISICAL_ENV=prod

RUN --mount=type=secret,id=app_env,target=/app/.env \
    --mount=type=secret,id=infisical_token,target=/run/secrets/infisical_token \
    set -a && . /app/.env && set +a && \
    export INFISICAL_TOKEN="$(cat /run/secrets/infisical_token)" && \
    export INFISICAL_API_URL="${INFISICAL_SITE_URL%/}/api" && \
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
