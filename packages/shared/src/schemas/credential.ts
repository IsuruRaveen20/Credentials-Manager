import { z } from "zod";

/** Suggested categories for the add/edit dropdowns + Categories page presets. */
export const PRESET_CREDENTIAL_CATEGORIES = [
  "Login Credentials",
  "Domain",
  "Hosting",
  "Cloud",
  "Database",
  "Saas",
  "Email",
  "Banking",
  "Ssh",
  "Vpn",
  "Api Key",
  "Access Key",
  "Tokens",
  "Development",
  "Other",
] as const;

export type PresetCredentialCategory = (typeof PRESET_CREDENTIAL_CATEGORIES)[number];

/** Title-case category for display + storage ("database" → "Database"). */
export function normalizeCategory(raw: string): string {
  return raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function isSshCategory(category: string): boolean {
  return normalizeCategory(category).toLowerCase() === "ssh";
}

/** AWS-style access key ID + secret access key pair. */
export function isAccessKeyCategory(category: string): boolean {
  return normalizeCategory(category).toLowerCase() === "access key";
}

/** Single bearer / API token secret. */
export function isTokenCategory(category: string): boolean {
  return normalizeCategory(category).toLowerCase() === "tokens";
}

/** Pretty labels for known acronyms (storage stays title-case: Ssh, Vpn, Api Key). */
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  ssh: "SSH",
  vpn: "VPN",
  "api key": "API Key",
  "access key": "Access Key",
  saas: "SaaS",
};

/** Display name for UI (chips, tables, dropdowns). */
export function formatCategoryLabel(category: string): string {
  const normalized = normalizeCategory(category);
  return CATEGORY_DISPLAY_NAMES[normalized.toLowerCase()] ?? normalized;
}

/** Free-form org category (created when users save credentials). */
export const credentialCategorySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_\- ]*$/, "Use letters, numbers, spaces, _ or -")
  .transform(normalizeCategory);

/** Optional logo as data URL (jpg/png/webp/svg) or https URL. Max ~96KB. */
export const credentialLogoSchema = z
  .string()
  .max(120_000)
  .optional()
  .nullable()
  .refine(
    (v) =>
      v == null ||
      v === "" ||
      v.startsWith("data:image/") ||
      /^https?:\/\//i.test(v),
    { message: "Logo must be an image data URL or http(s) link" },
  );

/**
 * How the cleartext login identity is used:
 * - username + password
 * - email + password
 * - none = secret-only (API key, token, etc.)
 */
export const loginKindSchema = z.enum(["username", "email", "none"]);

export type LoginKind = z.infer<typeof loginKindSchema>;

const hostSchema = z.string().trim().max(512).optional().nullable();
const portSchema = z.coerce.number().int().min(1).max(65535).optional().nullable();
const expiresAtSchema = z
  .union([z.string().datetime({ offset: true }), z.string().date(), z.literal(""), z.null()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || v === "") return null;
    return v;
  });

function refineIdentity(
  data: { loginKind?: LoginKind; username?: string | null; category?: string },
  ctx: z.RefinementCtx,
) {
  const loginKind = data.loginKind ?? "username";
  const identity = data.username?.trim() ?? "";
  const ssh = data.category ? isSshCategory(data.category) : false;
  const accessKey = data.category ? isAccessKeyCategory(data.category) : false;

  if (loginKind === "none" && !ssh && !accessKey) {
    return;
  }

  if (!identity && (ssh || accessKey || loginKind !== "none")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: accessKey
        ? "Access key is required"
        : loginKind === "email"
          ? "Email is required"
          : "Username is required",
      path: ["username"],
    });
  }

  if (loginKind === "email" && !accessKey && identity) {
    const emailOk = z.string().email().safeParse(identity);
    if (!emailOk.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email address",
        path: ["username"],
      });
    }
  }
}

export const createCredentialSchema = z
  .object({
    name: z.string().min(1).max(256),
    category: credentialCategorySchema,
    loginKind: loginKindSchema.default("username"),
    /** Username or email identity (ignored when loginKind is none, except SSH). */
    username: z.string().max(512).optional(),
    /** SSH hostname / IP / user@host (non-secret metadata). */
    host: hostSchema,
    /** SSH / connection port (non-secret metadata). */
    port: portSchema,
    /**
     * Primary secret: password for logins, or private key material for SSH.
     * For SSH, may be empty when `password` is set (password-only SSH).
     */
    secret: z.string().max(65536).optional().default(""),
    /** SSH account password (encrypted). Optional when a private key is provided. */
    password: z.string().max(4096).optional().nullable(),
    /** Optional passphrase for encrypted private keys (stored inside ciphertext). */
    passphrase: z.string().max(4096).optional().nullable(),
    notes: z.string().max(65536).optional(),
    tags: z.array(z.string().max(64)).max(32).optional(),
    logoDataUrl: credentialLogoSchema,
    /** Optional expiry for rotation reminders (ISO date or datetime). */
    expiresAt: expiresAtSchema,
  })
  .superRefine((data, ctx) => {
    refineIdentity(data, ctx);
    if (isSshCategory(data.category)) {
      if (!data.host?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Host is required for SSH",
          path: ["host"],
        });
      }
      const hasKey = Boolean(data.secret?.trim());
      const hasPassword = Boolean(data.password?.trim());
      if (!hasKey && !hasPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide an SSH password and/or a private key",
          path: ["password"],
        });
      }
    } else if (!data.secret?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: isAccessKeyCategory(data.category)
          ? "Secret access key is required"
          : isTokenCategory(data.category)
            ? "Token is required"
            : "Secret is required",
        path: ["secret"],
      });
    }
  });

export const updateCredentialSchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    category: credentialCategorySchema.optional(),
    loginKind: loginKindSchema.optional(),
    username: z.string().max(512).optional().nullable(),
    host: hostSchema,
    port: portSchema,
    secret: z.string().max(65536).optional(),
    password: z.string().max(4096).optional().nullable(),
    passphrase: z.string().max(4096).optional().nullable(),
    notes: z.string().max(65536).optional(),
    tags: z.array(z.string().max(64)).max(32).optional(),
    logoDataUrl: credentialLogoSchema,
    expiresAt: expiresAtSchema,
  })
  .superRefine((data, ctx) => {
    if (data.loginKind === "email" && data.username != null && data.username.trim()) {
      const emailOk = z.string().email().safeParse(data.username.trim());
      if (!emailOk.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid email address",
          path: ["username"],
        });
      }
    }
    if (data.category && isSshCategory(data.category) && data.host !== undefined && !data.host?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host is required for SSH",
        path: ["host"],
      });
    }
  });

/** Dedicated rotate: always requires a new secret. */
export const rotateCredentialSchema = z.object({
  secret: z.string().min(1).max(65536),
  passphrase: z.string().max(4096).optional().nullable(),
  password: z.string().max(4096).optional().nullable(),
  /** Optionally bump / set expiry after rotate. */
  expiresAt: expiresAtSchema,
});

export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;
export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;
export type RotateCredentialInput = z.infer<typeof rotateCredentialSchema>;
