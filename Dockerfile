# syntax=docker/dockerfile:1.6
#
# EazePay partner-portal — production image for Railway.
#
# Three-stage build:
#   1. deps     — install pnpm workspace deps with the lockfile
#   2. builder  — produce the Next.js standalone bundle
#   3. runner   — minimal runtime image (~150MB) that runs `node server.js`
#
# Why standalone: Next.js writes a self-contained server.js + the only
# node_modules it actually traced, so we avoid shipping the 1GB+ pnpm
# store. The trace root in next.config.mjs is the monorepo root so the
# workspace-linked `@eazepay/ui` + `@eazepay/shared-types` packages
# resolve correctly inside the container.

# ─────────────────────────────────────────────────────────────────────
# 1. deps — install pnpm + workspace dependencies
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate

# Copy only the files needed for a deterministic install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY apps/partner-portal/package.json apps/partner-portal/
COPY libs ./libs

# Install workspace deps. We use --frozen-lockfile so Railway builds
# fail loud if package.json + lockfile drift.
RUN pnpm install --frozen-lockfile --filter=@eazepay/partner-portal...

# ─────────────────────────────────────────────────────────────────────
# 2. builder — produce the Next.js standalone output
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate

# Bring in the installed node_modules + the full repo source.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/partner-portal/node_modules ./apps/partner-portal/node_modules
COPY --from=deps /repo/libs ./libs
COPY . .

# Build the partner-portal app. `output: 'standalone'` in next.config.mjs
# writes the trim-down bundle to apps/partner-portal/.next/standalone.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter @eazepay/partner-portal build

# ─────────────────────────────────────────────────────────────────────
# 3. runner — minimal runtime
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
