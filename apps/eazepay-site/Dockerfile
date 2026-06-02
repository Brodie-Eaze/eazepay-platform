# syntax=docker/dockerfile:1.6
#
# EazePay marketing site (apps/eazepay-site) — production image for Railway.
# Build context is the monorepo ROOT. Mirrors the partner-portal image:
#   1. deps     — install pnpm workspace deps with the lockfile
#   2. builder  — produce the Next.js standalone bundle
#   3. runner   — minimal runtime that runs `node server.js`
#
# `output: 'standalone'` + outputFileTracingRoot = repo root (next.config.mjs)
# means the standalone bundle mirrors the repo layout and the workspace-linked
# @eazepay/ui resolves inside the container.

# ─────────────────────────────────────────────────────────────────────
# 1. deps
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY apps/eazepay-site/package.json apps/eazepay-site/
COPY libs ./libs

RUN pnpm install --frozen-lockfile --filter=@eazepay/eazepay-site...

# ─────────────────────────────────────────────────────────────────────
# 2. builder
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/eazepay-site/node_modules ./apps/eazepay-site/node_modules
COPY --from=deps /repo/libs ./libs
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter @eazepay/eazepay-site build

# ─────────────────────────────────────────────────────────────────────
# 3. runner
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/eazepay-site/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/eazepay-site/.next/static ./apps/eazepay-site/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/eazepay-site/public ./apps/eazepay-site/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/eazepay-site/server.js"]
