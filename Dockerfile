# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.mjs ./
COPY postcss.config.mjs ./
COPY tailwind.config.ts ./

# Install dependencies, then remove tsx (only needed for local dev,
# not for production build or runtime — and it crashes on modern Node)
RUN npm ci && rm -rf node_modules/tsx

# Copy source code
COPY src ./src
COPY public ./public
COPY prisma ./prisma

# Generate Prisma client
RUN npm run db:generate

# Build Next.js app
# Provide dummy env vars so Next.js can collect page data during build.
# Real values are injected at runtime via environment variables.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    REDIS_URL="redis://localhost:6379" \
    AUTH_SECRET="build-time-placeholder" \
    AUTH_URL="http://localhost:3000" \
    NEXT_PUBLIC_APP_URL="http://localhost:3000"
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy standalone output (includes node_modules and server.js)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + generated client
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Purge tsx from runtime — it uses the deprecated --loader API which
# crashes on modern Node. Search all node_modules locations.
RUN find /app -path "*/node_modules/tsx" -type d -exec rm -rf {} + 2>/dev/null; \
    find /app -path "*/node_modules/.store/tsx*" -type d -exec rm -rf {} + 2>/dev/null; \
    echo "tsx purged from runtime image"

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
