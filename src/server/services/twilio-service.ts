import { db } from "@/lib/db";
import { getMasterClient, getOrgClient } from "@/lib/twilio";
import { encrypt } from "@/utils/encryption";
import { syncBalanceToRedis } from "@/server/services/quota-service";
import type {
  BrandRegistrationInput,
  CampaignRegistrationInput,
  ProvisionNumberInput,
} from "@/lib/validators/twilio";

/**
 * Provision a Twilio subaccount for an organization.
 * Creates a subaccount under the master CivicText account.
 */
export async function provisionSubaccount(orgId: string, orgName: string) {
  // Check if subaccount already exists
  const existing = await db.twilioSubaccount.findUnique({ where: { orgId } });
  if (existing) {
    throw new Error("Twilio subaccount already exists for this organization");
  }

  const masterClient = getMasterClient();

  // Create subaccount
  const subaccount = await masterClient.api.accounts.create({
    friendlyName: `CivicText - ${orgName}`,
  });

  // Encrypt auth token before storage
  const authTokenEncrypted = encrypt(subaccount.authToken);

  // Store subaccount details
  const record = await db.twilioSubaccount.create({
    data: {
      orgId,
      accountSid: subaccount.sid,
      authTokenEncrypted,
    },
  });

  return record;
}

/**
 * Create a Twilio Messaging Service for an org's subaccount.
 */
export async function createMessagingService(orgId: string, orgName: string) {
  const subaccount = await db.twilioSubaccount.findUnique({ where: { orgId } });
  if (!subaccount) {
    throw new Error("No subaccount found. Provision a subaccount first.");
  }

  const client = await getOrgClient(orgId);
  const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const service = await client.messaging.v1.services.create({
    friendlyName: `${orgName} Messaging`,
    inboundRequestUrl: `${webhookBaseUrl}/api/webhooks/twilio/inbound?orgId=${orgId}`,
    statusCallback: `${webhookBaseUrl}/api/webhooks/twilio/status?orgId=${orgId}`,
    fallbackUrl: `${webhookBaseUrl}/api/webhooks/twilio/fallback?orgId=${orgId}`,
    stickySender: true,
    smartEncoding: true,
    validityPeriod: 14400, // 4 hours in seconds
  });

  // Update subaccount record with messaging service SID
  await db.twilioSubaccount.update({
    where: { orgId },
    data: { messagingServiceSid: service.sid },
  });

  return service;
}

/**
 * Register a brand with The Campaign Registry (TCR) via Twilio.
 */
export async function registerBrand(orgId: string, input: BrandRegistrationInput) {
  const masterClient = getMasterClient();

  // Submit brand registration to Twilio
  // In production, this would use the Trust Hub API for full brand vetting
  const brand = await masterClient.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: "", // Placeholder - requires Trust Hub setup
    a2PProfileBundleSid: "", // Placeholder - requires Trust Hub setup
  });

  // Store registration record
  const record = await db.brandRegistration.create({
    data: {
      orgId,
      twilioSid: brand.sid,
      brandName: input.brandName,
      ein: input.ein,
      brandType: input.brandType,
      address: input.address,
      website: input.website,
      status: "PENDING",
    },
  });

  return record;
}

/**
 * Register a campaign use case with TCR via Twilio.
 */
export async function registerCampaign(
  orgId: string,
  input: CampaignRegistrationInput
) {
  const brandReg = await db.brandRegistration.findFirst({
    where: { id: input.brandRegistrationId, orgId },
  });

  if (!brandReg) {
    throw new Error("Brand registration not found");
  }

  if (brandReg.status !== "APPROVED") {
    throw new Error("Brand registration must be approved before registering a campaign");
  }

  const masterClient = getMasterClient();
  const subaccount = await db.twilioSubaccount.findUnique({ where: { orgId } });

  if (!subaccount?.messagingServiceSid) {
    throw new Error("Messaging Service must be created before campaign registration");
  }

  // Submit campaign use case to Twilio
  const campaign = await masterClient.messaging.v1
    .services(subaccount.messagingServiceSid)
    .usAppToPerson.create({
      brandRegistrationSid: brandReg.twilioSid!,
      description: input.description,
      messageFlow: input.messageFlow,
      messageSamples: input.sampleMessages,
      usAppToPersonUsecase: input.useCase,
      hasEmbeddedLinks: true,
      hasEmbeddedPhone: false,
    });

  // Store campaign registration record
  const record = await db.campaignRegistration.create({
    data: {
      orgId,
      brandRegistrationId: input.brandRegistrationId,
      twilioSid: campaign.sid,
      useCase: input.useCase,
      description: input.description,
      sampleMessages: input.sampleMessages,
      messageFlow: input.messageFlow,
      status: "PENDING",
    },
  });

  return record;
}

/**
 * Provision phone number(s) for an org and add to their Messaging Service.
 */
export async function provisionPhoneNumbers(orgId: string, input: ProvisionNumberInput) {
  const subaccount = await db.twilioSubaccount.findUnique({ where: { orgId } });
  if (!subaccount?.messagingServiceSid) {
    throw new Error("Messaging Service must be created first");
  }

  // Check balance BEFORE purchasing any numbers from Twilio
  const plan = await db.messagingPlan.findUnique({ where: { orgId } });
  const feeCents = plan?.phoneNumberFeeCents || 500;
  const quantity = input.quantity || 1;
  const totalFeeCents = feeCents * quantity;

  if (!plan || plan.balanceCents < totalFeeCents) {
    throw new Error(
      `Insufficient balance. Phone numbers cost $${(feeCents / 100).toFixed(2)}/month each. ` +
      `Total for ${quantity} number${quantity > 1 ? "s" : ""}: $${(totalFeeCents / 100).toFixed(2)}. ` +
      `Your balance: $${((plan?.balanceCents || 0) / 100).toFixed(2)}.`
    );
  }

  const client = await getOrgClient(orgId);
  const numbers = [];

  for (let i = 0; i < quantity; i++) {
    // Search for available numbers
    const searchParams: Record<string, unknown> = {
      limit: 1,
      smsEnabled: true,
      mmsEnabled: true,
    };
    if (input.areaCode) {
      searchParams.areaCode = input.areaCode;
    }

    const available = await client
      .availablePhoneNumbers("US")
      .local.list(searchParams);

    if (available.length === 0) {
      throw new Error(
        input.areaCode
          ? `No numbers available in area code ${input.areaCode}`
          : "No numbers available"
      );
    }

    // Purchase the number from Twilio
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
    });

    // Add to Messaging Service
    await client.messaging.v1
      .services(subaccount.messagingServiceSid)
      .phoneNumbers.create({
        phoneNumberSid: purchased.sid,
      });

    const now = new Date();

    // Store in database and charge first month's fee in one transaction
    const record = await db.$transaction(async (tx) => {
      const pn = await tx.phoneNumber.create({
        data: {
          orgId,
          twilioSid: purchased.sid,
          phoneNumber: purchased.phoneNumber,
          capabilities: {
            voice: purchased.capabilities?.voice ?? false,
            sms: purchased.capabilities?.sms ?? false,
            mms: purchased.capabilities?.mms ?? false,
          },
          status: "ACTIVE",
          lastChargedAt: now,
        },
      });

      // Charge first month immediately
      await tx.messagingPlan.update({
        where: { orgId },
        data: {
          balanceCents: { decrement: feeCents },
          totalSpentCents: { increment: feeCents },
        },
      });

      return pn;
    });

    // Sync Redis balance after charge
    await syncBalanceToRedis(orgId);

    numbers.push(record);
  }

  return numbers;
}

/**
 * Release a phone number back to Twilio.
 */
export async function releasePhoneNumber(orgId: string, phoneNumberId: string) {
  const phoneNumber = await db.phoneNumber.findFirst({
    where: { id: phoneNumberId, orgId },
  });

  if (!phoneNumber) {
    throw new Error("Phone number not found");
  }

  const client = await getOrgClient(orgId);
  await client.incomingPhoneNumbers(phoneNumber.twilioSid).remove();

  await db.phoneNumber.update({
    where: { id: phoneNumberId },
    data: { status: "RELEASED" },
  });
}

/**
 * Get the 10DLC registration status for an org.
 */
export async function getRegistrationStatus(orgId: string) {
  const [brandRegs, campaignRegs, phoneNumbers, subaccount] = await Promise.all([
    db.brandRegistration.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } }),
    db.campaignRegistration.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } }),
    db.phoneNumber.findMany({ where: { orgId, status: "ACTIVE" } }),
    db.twilioSubaccount.findUnique({ where: { orgId } }),
  ]);

  return {
    hasSubaccount: !!subaccount,
    hasMessagingService: !!subaccount?.messagingServiceSid,
    brandRegistrations: brandRegs,
    campaignRegistrations: campaignRegs,
    phoneNumbers,
    isFullyRegistered:
      brandRegs.some((b) => b.status === "APPROVED") &&
      campaignRegs.some((c) => c.status === "APPROVED") &&
      phoneNumbers.length > 0,
  };
}
