// RBAC Role hierarchy (higher index = more permissions)
export const ROLE_HIERARCHY = ["VIEWER", "SENDER", "MANAGER", "ADMIN", "OWNER"] as const;

// Permissions
export const PERMISSIONS = {
  CAMPAIGN_CREATE: "campaign:create",
  CAMPAIGN_SEND: "campaign:send",
  CONTACTS_IMPORT: "contacts:import",
  CONTACTS_DELETE: "contacts:delete",
  ANALYTICS_VIEW: "analytics:view",
  USERS_MANAGE: "users:manage",
  BILLING_MANAGE: "billing:manage",
  ORG_SETTINGS: "org:settings",
  API_KEYS: "api:keys",
  DATA_EXPORT: "data:export",
  INBOX_VIEW: "inbox:view",
  INBOX_REPLY: "inbox:reply",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role -> Permission mapping
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_SEND,
    PERMISSIONS.CONTACTS_IMPORT,
    PERMISSIONS.CONTACTS_DELETE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ORG_SETTINGS,
    PERMISSIONS.API_KEYS,
    PERMISSIONS.DATA_EXPORT,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.INBOX_REPLY,
  ],
  MANAGER: [
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_SEND,
    PERMISSIONS.CONTACTS_IMPORT,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.DATA_EXPORT,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.INBOX_REPLY,
  ],
  SENDER: [
    PERMISSIONS.CAMPAIGN_SEND,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.INBOX_REPLY,
  ],
  VIEWER: [
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.DATA_EXPORT,
    PERMISSIONS.INBOX_VIEW,
  ],
};

// Opt-out keywords (TCPA/CTIA required)
export const OPT_OUT_KEYWORDS = [
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
];

// Opt-in keywords
export const OPT_IN_KEYWORDS = ["START", "YES", "UNSTOP"];

// Quiet hours defaults
export const DEFAULT_QUIET_HOURS_START = "21:00"; // 9 PM
export const DEFAULT_QUIET_HOURS_END = "08:00"; // 8 AM

// SMS segment limits
export const GSM7_SEGMENT_LENGTH = 160;
export const GSM7_MULTIPART_SEGMENT_LENGTH = 153;
export const UCS2_SEGMENT_LENGTH = 70;
export const UCS2_MULTIPART_SEGMENT_LENGTH = 67;

// Default messaging rates (in cents)
export const DEFAULT_SMS_RATE_CENTS = 4;
export const DEFAULT_MMS_RATE_CENTS = 8;

// Minimum transaction amount (in cents)
export const MIN_TRANSACTION_CENTS = 500; // $5.00
