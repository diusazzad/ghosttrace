# Multi-stage production Dockerfile for GhostTrace
# Optimized for minimal image size, non-root security, and production caching.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build the Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs &&     adduser --system --uid 1001 nextjs

# Copy runtime assets
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["pnpm", "start"]
