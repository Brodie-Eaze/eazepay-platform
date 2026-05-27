# syntax=docker/dockerfile:1.6
#
# EazePay partner-portal — production image for Railway.
#
# Two-stage build:
#   1. builder  — install deps + produce the Next.js standalone bundle
#                 (single stage avoids the libs/*/node_modules symlink-
#                 overwrite class of bugs that broke earlier multi-stage
#                 attempts)
#   2. runner   — minimal runtime image (~150MB) that runs `node server.js`
#
# Why standalone: Next.js writes a self-contained server.js + the only
# node_modules it actually traced, so we avoid shipping the 1GB+ pnpm
# store. The trace root in next.config.mjs is the monorepo root so the
# workspace-linked `@eazepay/ui` + `@eazepay/shared-types` packages
# resolve correctly inside the container.

# ─────────────────────────────────────────────────────────────────────
# 1. builder — install + build in a single stage
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate

# Copy the entire repo (node_modules + .next + dist + .git etc. are
# stripped by .dockerignore). Single COPY means there is no second
# layer that can wipe out pnpm's symlinks in libs/*/node_modules.
COPY . .

# Install with --frozen-lockfile so package.json + lockfile drift fails
# loud. Use --filter=@eazepay/partner-portal... so we only install the
# deps needed for the partner-portal app + its workspace deps (not the
# whole monorepo).
RUN pnpm install --frozen-lockfile --filter=@eazepay/partner-portal...

# Build the partner-portal app. `output: 'standalone'` in next.config.mjs
# writes the trim-down bundle to apps/partner-portal/.next/standalone.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PHASE=phase-production-build
RUN pnpm --filter @eazepay/partner-portal build

# ─────────────────────────────────────────────────────────────────────
# 2. runner — minimal runtime
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway sets $PORT automatically. Default to 3000 if missing.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user (security best practice).
RUN addgroup --system --gid 1001 nodejs \
  && adduser  --system --uid 1001 nextjs

# Copy the standalone bundle, public assets, and prebuilt .next/static.
# Paths reflect the trace root being the monorepo root.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/partner-portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/partner-portal/.next/static ./apps/partner-portal/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/partner-portal/public ./apps/partner-portal/public

USER nextjs
EXPOSE 3000

# server.js lives at apps/partner-portal/server.js inside the standalone
# bundle (because the trace root is the repo root).
CMD ["node", "apps/partner-portal/server.js"]
