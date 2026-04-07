import { z } from "zod";

export const brandRegistrationSchema = z.object({
  brandName: z.string().min(1, "Brand name is required"),
  ein: z.string().optional(),
  brandType: z.enum(["political", "government", "nonprofit", "advocacy"]),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(2).max(2),
    postalCode: z.string().min(5),
    country: z.string().default("US"),
  }),
  website: z.string().url().optional(),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(10),
});

export type BrandRegistrationInput = z.infer<typeof brandRegistrationSchema>;

export const campaignRegistrationSchema = z.object({
  brandRegistrationId: z.string().uuid(),
  useCase: z.enum([
    "voter_outreach",
    "event_notifications",
    "donation_solicitation",
    "government_alerts",
    "advocacy_action_alerts",
    "general_political",
  ]),
  description: z.string().min(40, "Description must be at least 40 characters"),
  sampleMessages: z
    .array(z.string().min(20, "Each sample message must be at least 20 characters"))
    .min(2, "At least 2 sample messages required")
    .max(5),
  messageFlow: z.string().min(20, "Message flow description is required"),
});

export type CampaignRegistrationInput = z.infer<typeof campaignRegistrationSchema>;

export const provisionNumberSchema = z.object({
  areaCode: z.string().length(3).optional(),
  quantity: z.number().int().min(1).max(20).default(1),
});

export type ProvisionNumberInput = z.infer<typeof provisionNumberSchema>;

// Pre-built use case templates for the 10DLC wizard
export const USE_CASE_TEMPLATES: Record<
  string,
  { description: string; sampleMessages: string[]; messageFlow: string }
> = {
  voter_outreach: {
    description:
      "Communicating with registered voters about candidate positions, voting information, polling locations, and election reminders.",
    sampleMessages: [
      "Hi {firstName}, early voting starts tomorrow! Find your polling location at [link]. Reply STOP to opt out.",
      "Election Day is Nov 5. Make your voice heard! Polls open 7AM-8PM. Paid for by {orgName}. Reply STOP to unsubscribe.",
    ],
    messageFlow:
      "Voters opt in via web form on campaign website or by texting JOIN to our number. Confirmation message sent on opt-in. Messages sent 1-4 times per month during campaign season.",
  },
  event_notifications: {
    description:
      "Notifying supporters about campaign events, town halls, rallies, volunteer opportunities, and community meetings.",
    sampleMessages: [
      "Join us for a town hall this Saturday at 2PM, Community Center, 123 Main St. RSVP: [link]. Reply STOP to opt out.",
      "Volunteer opportunity: Phone banking this Wed 6-8PM. Sign up: [link]. Paid for by {orgName}. Reply STOP to unsubscribe.",
    ],
    messageFlow:
      "Supporters opt in by signing up on event registration forms or texting EVENTS to our number. Confirmation sent on opt-in. Event reminders sent as events are scheduled.",
  },
  donation_solicitation: {
    description:
      "Soliciting donations from supporters for political campaigns, PACs, or advocacy organizations with proper FEC disclosures.",
    sampleMessages: [
      "Hi {firstName}, we're $5,000 from our goal. Can you chip in $25? Donate: [link]. Paid for by {orgName}. Reply STOP to opt out.",
      "Matching donations doubled today only! Every $1 = $2. Give now: [link]. Paid for by {orgName}. Reply STOP to unsubscribe.",
    ],
    messageFlow:
      "Donors opt in via donation page checkbox or by texting DONATE to our number. Opt-in confirmation sent. Solicitation messages sent 2-4 times per month.",
  },
  government_alerts: {
    description:
      "Official government communications including public safety alerts, service notifications, meeting reminders, and community updates.",
    sampleMessages: [
      "City of {city}: Water main repair on Oak St. Expected 2-hour service interruption 10AM-12PM. Details: [link]. Reply STOP to opt out.",
      "Reminder: City Council meeting tonight at 7PM, City Hall. Agenda: [link]. Reply STOP to unsubscribe.",
    ],
    messageFlow:
      "Residents opt in via city website or by texting ALERTS to the city number. Confirmation sent on opt-in. Alert frequency varies by event urgency.",
  },
  advocacy_action_alerts: {
    description:
      "Mobilizing supporters to take action on policy issues including contacting elected officials, signing petitions, and attending hearings.",
    sampleMessages: [
      "ACTION: Bill HB-1234 is up for vote tomorrow. Call your rep now: [link]. Your voice matters! Reply STOP to opt out.",
      "Victory! Thanks to your calls, the committee voted YES on clean water protections. Next steps: [link]. Reply STOP to unsubscribe.",
    ],
    messageFlow:
      "Supporters opt in by signing up on advocacy website or texting ACT to our number. Opt-in confirmation sent. Action alerts sent as legislation moves.",
  },
  general_political: {
    description:
      "General political communications including campaign updates, policy positions, endorsements, and supporter engagement.",
    sampleMessages: [
      "Hi {firstName}, check out our new policy plan on healthcare: [link]. Paid for by {orgName}. Reply STOP to opt out.",
      "Thank you for your support! Here's our latest campaign update: [link]. Paid for by {orgName}. Reply STOP to unsubscribe.",
    ],
    messageFlow:
      "Supporters opt in via campaign website or by texting JOIN to our number. Opt-in confirmation sent. Updates sent 2-6 times per month.",
  },
};
