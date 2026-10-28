import { z } from "zod";

const text = z.string().trim().min(1).max(120);
export const DraftInputSchema = z.strictObject({
  founderName: text,
  contactNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format, for example +12025550123."),
  facts: z.array(z.strictObject({ label: text, value: z.string().trim().min(1).max(1000) })).max(30),
  disclosure: z.strictObject({
    text: z.string().trim().max(2000),
    purpose: z.string().trim().max(1000),
    consentFlow: z.string().trim().max(2000),
    refusalFlow: z.string().trim().max(2000),
  }),
});
export const CreateSetupSchema = DraftInputSchema.extend({
  businessName: text,
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  industry: text,
  timezone: text.refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Use an IANA timezone."),
});
export type DraftInput = z.infer<typeof DraftInputSchema>;
export type CreateSetupInput = z.infer<typeof CreateSetupSchema>;

export const DISABLED_CAPABILITIES = Object.freeze({
  recording: false, transcription: false, aiAnswering: false, forwarding: false,
  outboundCalls: false, automatedFollowUp: false, memoryIngestion: false,
} as const);

export function buildSetupDraft(input: DraftInput, revision: number) {
  return {
    ...DraftInputSchema.parse({ founderName: input.founderName, contactNumber: input.contactNumber, facts: input.facts, disclosure: input.disclosure }),
    schemaVersion: "inactive-client-setup.v1" as const,
    revision,
    status: "draft" as const,
    ownershipVerification: "pending" as const,
    routingVerification: "pending" as const,
    provisioned: false as const,
    capabilities: { ...DISABLED_CAPABILITIES },
    receptionistPublication: "not_published" as const,
    consentApproval: "pending" as const,
  };
}
export type SetupDraft = ReturnType<typeof buildSetupDraft>;
export const SetupDraftSchema = DraftInputSchema.extend({
  schemaVersion: z.literal("inactive-client-setup.v1"), revision: z.number().int().positive(),
  status: z.literal("draft"), ownershipVerification: z.literal("pending"),
  routingVerification: z.literal("pending"), provisioned: z.literal(false),
  capabilities: z.strictObject({
    recording: z.literal(false), transcription: z.literal(false), aiAnswering: z.literal(false),
    forwarding: z.literal(false), outboundCalls: z.literal(false),
    automatedFollowUp: z.literal(false), memoryIngestion: z.literal(false),
  }),
  receptionistPublication: z.literal("not_published"), consentApproval: z.literal("pending"),
});
export const UpdateSetupSchema = z.strictObject({
  revision: z.number().int().positive(), draft: DraftInputSchema,
});
export function normalizedBusinessName(name: string) {
  return name.normalize("NFKC").toLowerCase().replace(/&/g, "and").replace(/[^\p{L}\p{N}]/gu, "");
}

export function localSetupWritesAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV === "production" || env.VERCEL || env.VERCEL_ENV || env.RESPONSEOS_LOCAL_CLIENT_SETUP !== "1") return false;
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && (url.pathname === "/responseos_inactive_setup_test" || (env.NODE_ENV === "test" && url.pathname === "/responseos_test"));
  } catch { return false; }
}
