# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.mjs ./
COPY postcss.config.mjs ./
COPY tailwind.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY public ./public
COPY prisma ./prisma

# Generate Prisma client (needs prisma CLI + tsx)
RUN npm run db:generate

# Remove prisma CLI and tsx BEFORE next build so they are never
# traced into the standalone output. Only @prisma/client is needed.
RUN rm -rf node_modules/tsx node_modules/prisma

# Build Next.js app (prisma generate already ran above)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    REDIS_URL="redis://localhost:6379" \
    AUTH_SECRET="build-time-placeholder" \
    AUTH_URL="http://localhost:3000" \
    NEXT_PUBLIC_APP_URL="http://localhost:3000"
RUN npx next build

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

# Replace tsx with a no-op stub — @prisma/client tries to import tsx
# at runtime, but we can't let the real tsx load (it crashes). This
# stub satisfies the import without registering any loader.
RUN find /app -path "*/node_modules/tsx" -type d -exec rm -rf {} + 2>/dev/null; \
    mkdir -p /app/node_modules/tsx/dist/esm && \
    echo '{"name":"tsx","version":"0.0.0","type":"module","exports":{".":"./dist/esm/index.mjs","./esm":"./dist/esm/index.mjs"}}' > /app/node_modules/tsx/package.json && \
    echo 'export default undefined;' > /app/node_modules/tsx/dist/esm/index.mjs && \
    echo "tsx replaced with no-op stub"

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
