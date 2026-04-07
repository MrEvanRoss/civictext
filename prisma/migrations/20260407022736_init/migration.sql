-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'SENDER', 'VIEWER');

-- CreateEnum
CREATE TYPE "OptInStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT', 'PENDING', 'NEVER_OPTED_IN');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('BROADCAST', 'P2P', 'DRIP', 'AUTO_REPLY');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'UNDELIVERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('OPEN', 'PENDING', 'ARCHIVED', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "BrandRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PhoneNumberStatus" AS ENUM ('ACTIVE', 'RELEASED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "quietHoursStart" TEXT NOT NULL DEFAULT '21:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '08:00',
    "politicalDisclaimer" TEXT,
    "orgType" TEXT NOT NULL DEFAULT 'political',
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SENDER',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "tags" TEXT[],
    "customFields" JSONB,
    "optInStatus" "OptInStatus" NOT NULL DEFAULT 'NEVER_OPTED_IN',
    "optInSource" TEXT,
    "optInTimestamp" TIMESTAMP(3),
    "optOutTimestamp" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentAuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "messageBody" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "segmentId" TEXT,
    "segmentSnapshot" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "settings" JSONB,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "optOutCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DripStep" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "messageBody" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "variantB" TEXT,
    "splitPercent" INTEGER DEFAULT 50,

    CONSTRAINT "DripStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "campaignId" TEXT,
    "contactId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "twilioSid" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "segmentCount" INTEGER NOT NULL DEFAULT 1,
    "isOverage" BOOLEAN NOT NULL DEFAULT false,
    "cost" DECIMAL(65,30),
    "errorCode" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoReplyRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "replyBody" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoReplyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "state" "ConversationState" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickReplyTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickReplyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwilioSubaccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "accountSid" TEXT NOT NULL,
    "authTokenEncrypted" TEXT NOT NULL,
    "messagingServiceSid" TEXT,

    CONSTRAINT "TwilioSubaccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumber" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "twilioSid" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "capabilities" JSONB,
    "status" "PhoneNumberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRegistration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "twilioSid" TEXT,
    "brandName" TEXT NOT NULL,
    "ein" TEXT,
    "brandType" TEXT NOT NULL,
    "address" JSONB,
    "website" TEXT,
    "status" "BrandRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRegistration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "brandRegistrationId" TEXT NOT NULL,
    "twilioSid" TEXT,
    "useCase" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sampleMessages" TEXT[],
    "messageFlow" TEXT,
    "status" "CampaignRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingPlan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL DEFAULT 'STARTER',
    "monthlyAllotment" INTEGER NOT NULL,
    "overagePermitted" BOOLEAN NOT NULL DEFAULT false,
    "overageRate" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "billingCycleDay" INTEGER NOT NULL DEFAULT 1,
    "addOnBlockSize" INTEGER NOT NULL DEFAULT 5000,
    "addOnBlockPrice" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "campaignId" TEXT,
    "segmentCount" INTEGER NOT NULL,
    "isOverage" BOOLEAN NOT NULL DEFAULT false,
    "twilioCost" DECIMAL(65,30),
    "billingCycleStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOnPurchase" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "stripePaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddOnPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAlert" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BillingAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "columnMapping" JSONB,
    "consentSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Contact_orgId_optInStatus_idx" ON "Contact"("orgId", "optInStatus");

-- CreateIndex
CREATE INDEX "Contact_orgId_createdAt_idx" ON "Contact"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_tags_idx" ON "Contact" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_orgId_phone_key" ON "Contact"("orgId", "phone");

-- CreateIndex
CREATE INDEX "Segment_orgId_idx" ON "Segment"("orgId");

-- CreateIndex
CREATE INDEX "ConsentAuditLog_orgId_contactId_idx" ON "ConsentAuditLog"("orgId", "contactId");

-- CreateIndex
CREATE INDEX "ConsentAuditLog_orgId_createdAt_idx" ON "ConsentAuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_orgId_status_idx" ON "Campaign"("orgId", "status");

-- CreateIndex
CREATE INDEX "Campaign_orgId_createdAt_idx" ON "Campaign"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "DripStep_orgId_idx" ON "DripStep"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "DripStep_campaignId_stepOrder_key" ON "DripStep"("campaignId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Message_twilioSid_key" ON "Message"("twilioSid");

-- CreateIndex
CREATE INDEX "Message_orgId_createdAt_idx" ON "Message"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_orgId_campaignId_idx" ON "Message"("orgId", "campaignId");

-- CreateIndex
CREATE INDEX "Message_contactId_createdAt_idx" ON "Message"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_twilioSid_idx" ON "Message"("twilioSid");

-- CreateIndex
CREATE INDEX "AutoReplyRule_orgId_isActive_idx" ON "AutoReplyRule"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "Conversation_orgId_state_idx" ON "Conversation"("orgId", "state");

-- CreateIndex
CREATE INDEX "Conversation_orgId_assignedToId_idx" ON "Conversation"("orgId", "assignedToId");

-- CreateIndex
CREATE INDEX "Conversation_orgId_lastMessageAt_idx" ON "Conversation"("orgId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_orgId_contactId_key" ON "Conversation"("orgId", "contactId");

-- CreateIndex
CREATE INDEX "ConversationNote_conversationId_idx" ON "ConversationNote"("conversationId");

-- CreateIndex
CREATE INDEX "QuickReplyTemplate_orgId_idx" ON "QuickReplyTemplate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TwilioSubaccount_orgId_key" ON "TwilioSubaccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumber_twilioSid_key" ON "PhoneNumber"("twilioSid");

-- CreateIndex
CREATE INDEX "PhoneNumber_orgId_status_idx" ON "PhoneNumber"("orgId", "status");

-- CreateIndex
CREATE INDEX "BrandRegistration_orgId_idx" ON "BrandRegistration"("orgId");

-- CreateIndex
CREATE INDEX "CampaignRegistration_orgId_idx" ON "CampaignRegistration"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingPlan_orgId_key" ON "MessagingPlan"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLedger_messageId_key" ON "UsageLedger"("messageId");

-- CreateIndex
CREATE INDEX "UsageLedger_orgId_billingCycleStart_idx" ON "UsageLedger"("orgId", "billingCycleStart");

-- CreateIndex
CREATE INDEX "UsageLedger_orgId_createdAt_idx" ON "UsageLedger"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AddOnPurchase_orgId_idx" ON "AddOnPurchase"("orgId");

-- CreateIndex
CREATE INDEX "BillingAlert_orgId_idx" ON "BillingAlert"("orgId");

-- CreateIndex
CREATE INDEX "ImportJob_orgId_idx" ON "ImportJob"("orgId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAuditLog" ADD CONSTRAINT "ConsentAuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAuditLog" ADD CONSTRAINT "ConsentAuditLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DripStep" ADD CONSTRAINT "DripStep_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DripStep" ADD CONSTRAINT "DripStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyRule" ADD CONSTRAINT "AutoReplyRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickReplyTemplate" ADD CONSTRAINT "QuickReplyTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwilioSubaccount" ADD CONSTRAINT "TwilioSubaccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRegistration" ADD CONSTRAINT "BrandRegistration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRegistration" ADD CONSTRAINT "CampaignRegistration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRegistration" ADD CONSTRAINT "CampaignRegistration_brandRegistrationId_fkey" FOREIGN KEY ("brandRegistrationId") REFERENCES "BrandRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingPlan" ADD CONSTRAINT "MessagingPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOnPurchase" ADD CONSTRAINT "AddOnPurchase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAlert" ADD CONSTRAINT "BillingAlert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
