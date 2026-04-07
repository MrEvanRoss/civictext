#!/bin/bash
set -euo pipefail

# CivicText Deployment Script
# Usage: ./scripts/deploy.sh [vercel|docker]

MODE=${1:-"vercel"}

echo "==================================="
echo "CivicText Deployment ($MODE)"
echo "==================================="

# Pre-flight checks
echo ""
echo "[1/5] Running pre-flight checks..."

# TypeScript
echo "  - TypeScript compilation..."
npx tsc --noEmit
echo "    OK"

# Prisma
echo "  - Prisma client generation..."
npx prisma generate
echo "    OK"

# Build
echo "  - Next.js build..."
npm run build
echo "    OK"

echo ""
echo "[2/5] Pre-flight checks passed."

if [ "$MODE" = "vercel" ]; then
  echo ""
  echo "[3/5] Deploying to Vercel..."
  echo ""
  echo "Make sure you have set these environment variables in Vercel:"
  echo "  - DATABASE_URL"
  echo "  - REDIS_URL"
  echo "  - AUTH_SECRET"
  echo "  - AUTH_URL"
  echo "  - NEXT_PUBLIC_APP_URL"
  echo "  - ENCRYPTION_KEY"
  echo "  - TWILIO_ACCOUNT_SID"
  echo "  - TWILIO_AUTH_TOKEN"
  echo ""

  vercel --prod

  echo ""
  echo "[4/5] Running database migrations..."
  echo "  Run this manually with your production DATABASE_URL:"
  echo '  npx prisma migrate deploy --url "postgresql://..."'
  echo ""
  echo "[5/5] Deploy workers separately on Railway/Fly.io"
  echo "  See Dockerfile.workers for the worker container."

elif [ "$MODE" = "docker" ]; then
  echo ""
  echo "[3/5] Building Docker images..."

  docker build -t civictext:latest .
  docker build -t civictext-workers:latest -f Dockerfile.workers .

  echo ""
  echo "[4/5] Starting services..."
  echo "  Make sure .env.prod is configured with all required variables."
  echo ""

  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

  echo ""
  echo "[5/5] Running database migrations..."
  docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

  echo ""
  echo "Deployment complete!"
  echo "  App:     http://localhost:3000"
  echo "  Workers: running in background"

else
  echo "Unknown mode: $MODE"
  echo "Usage: ./scripts/deploy.sh [vercel|docker]"
  exit 1
fi

echo ""
echo "==================================="
echo "Post-deployment checklist:"
echo "==================================="
echo "  [ ] Verify app loads at your domain"
echo "  [ ] Create super admin user"
echo "  [ ] Configure Twilio webhook URLs:"
echo "      Status:  https://yourdomain.com/api/webhooks/twilio/status"
echo "      Inbound: https://yourdomain.com/api/webhooks/twilio/inbound?orgId=<ORG_ID>"
echo "  [ ] Test registration flow"
echo "  [ ] Test 10DLC registration wizard"
echo "  [ ] Verify Redis connection (admin > system health)"
echo ""
