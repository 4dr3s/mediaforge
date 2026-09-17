# API image -- NestJS + TypeScript. Build context is the repository root (`context: ..`).
FROM node:22-slim AS base

# `wget` is not decoration: the compose healthcheck for this service calls it against `/health`,
# and `docker compose up --wait` reads that healthcheck (task 1.4).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Pinned to the same version as the host (`packageManager` in the root package.json), so the
# lockfile means the same thing in both places.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Manifests first, sources second: the dependency layer stays cached while only source changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api

# `--fail-if-no-match` is mandatory here as well. Without it, a filter that matches nothing exits
# 0 and the image builds with no `dist/` at all, which fails later as a container crash instead of
# a build error (defect D1, found on the host-side command and reproduced in the Makefile).
RUN pnpm --filter api --fail-if-no-match run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# The node image ships an unprivileged `node` user (uid 1000), and the API has no reason to be
# root. Spelled numerically rather than as `USER node` (hadolint DL3066): `mediaforge-storage` is
# shared with the worker, which runs as uid 10001, and a Docker volume records ownership by
# number. A name would leave that number implicit exactly where two containers must agree on it.
#
# Note for WU-16/WU-17: the API does not write to /storage yet. When it starts to (inbox write,
# artifact read), the shared volume's ownership becomes a real decision, flagged in compose.yaml.
USER 1000:1000

CMD ["pnpm", "--filter", "api", "run", "start:prod"]
