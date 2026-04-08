# CivicText Deployment Guide

## Prerequisites

- Node.js 20+ (LTS)
- PostgreSQL 15+
- Redis 7+
- Twilio account with A2P 10DLC registration capability
- Stripe account (for billing/prepaid credits)
- Domain with SSL for production

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `AUTH_URL` | App base URL (e.g. `https://app.civictext.com`) |
| `NEXT_PUBLIC_APP_URL` | Public app URL (same as AUTH_URL) |
| `TWILIO_ACCOUNT_SID` | Twilio master account SID |
| `TWILIO_AUTH_TOKEN` | Twilio master auth token |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `ENCRYPTION_KEY` | AES-256 key for encrypting Twilio tokens at rest (`openssl rand -hex 32`) |

### Optional

| Variable | Description |
|---|---|
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Microsoft Entra OAuth client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Microsoft Entra OAuth client secret |
| `S3_BUCKET` | S3/R2 bucket for file storage (MMS media, imports) |
| `S3_REGION` | S3 region |
| `S3_ACCESS_KEY_ID` | S3 access key |
| `S3_SECRET_ACCESS_KEY` | S3 secret key |
| `S3_ENDPOINT` | S3-compatible endpoint (for Cloudflare R2) |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `EMAIL_FROM` | Sender address for transactional email |
| `SENTRY_DSN` | Sentry DSN for error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (client-side) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps |
| `STRIPE_STARTER_PRICE_ID` | Stripe price ID for starter plan |
| `STRIPE_GROWTH_PRICE_ID` | Stripe price ID for growth plan |
| `STRIPE_PROFESSIONAL_PRICE_ID` | Stripe price ID for professional plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe price ID for enterprise plan |

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Start PostgreSQL and Redis (Docker example)
docker run -d --name civictext-pg -p 5432:5432 \
  -e POSTGRES_USER=civictext -e POSTGRES_PASSWORD=civictext_dev \
  -e POSTGRES_DB=civictext postgres:15
docker run -d --name civictext-redis -p 6379:6379 redis:7

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate --config ./prisma/prisma.config.ts

# Create superadmin user
SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD=changeme npm run create-admin

# Start app + workers
npm run dev:all
```

App runs at `http://localhost:3000`. Prisma Studio: `npm run db:studio`.

## Production Deployment

### Web App (Vercel)

1. Connect repo to Vercel
2. Set all required environment variables in Vercel dashboard
3. Set build command: `npm run build` (runs `prisma generate` then `next build`)
4. Set output directory: `.next`
5. Deploy

### Workers (Railway or Fly.io)

The BullMQ message workers run separately from the Next.js app.

**Railway:**
1. Create new service from same repo
2. Set start command: `npm run workers`
3. Set environment variables (same `DATABASE_URL`, `REDIS_URL`, `TWILIO_*`, `ENCRYPTION_KEY`)
4. Deploy

**Fly.io:**
1. Use the included `Dockerfile.workers`
2. `fly launch --dockerfile Dockerfile.workers`
3. Set secrets: `fly secrets set DATABASE_URL=... REDIS_URL=... TWILIO_ACCOUNT_SID=...`
4. Deploy: `fly deploy`

### Database (Railway / Supabase / Neon)

Use any managed PostgreSQL provider. Ensure `DATABASE_URL` includes `?schema=public`.

### Redis (Upstash / Railway)

Upstash is recommended for serverless-friendly Redis. Set `REDIS_URL` accordingly.

## Database Migrations

```bash
# Create a new migration
npx prisma migrate dev --name description_of_change

# Apply migrations in production
npx prisma migrate deploy

# Reset database (destroys data)
npx prisma migrate reset

# Push schema without migration (prototyping only)
npx prisma db push
```

## Post-Deployment Checklist

1. **Create superadmin account**
   ```bash
   SUPERADMIN_EMAIL=admin@yourdomain.com \
   SUPERADMIN_PASSWORD=<secure-password> \
   SUPERADMIN_NAME="Platform Admin" \
   npx tsx scripts/create-superadmin.ts
   ```

2. **Configure Twilio webhooks** -- set these in each org's Twilio subaccount:
   - Inbound SMS: `https://app.civictext.com/api/webhooks/twilio/inbound?orgId=<ORG_ID>`
   - Status callback: `https://app.civictext.com/api/webhooks/twilio/status?orgId=<ORG_ID>`

3. **Set up 10DLC registration** -- each org must register:
   - Brand registration (EIN, org details)
   - Campaign use-case registration (sample messages, message flow)
   - Assign phone numbers to the registered campaign

4. **Configure Stripe webhooks** -- point to:
   - `https://app.civictext.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`

5. **Verify workers are running** -- check Redis connection and BullMQ queue processing

6. **Set up monitoring** -- configure Sentry DSN for error tracking in production
