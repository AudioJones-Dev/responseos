import { z } from "zod";

export const FrlWebInquirySchema = z
  .object({
    schemaVersion: z.literal(1),
    need: z.enum([
      "New equipment + installation",
      "Installation only",
      "Service or repair",
      "Help planning a build",
    ]),
    equipment: z.enum([
      "Platform lift",
      "Stair lift",
      "Wheelchair ramp",
      "Vehicle lift",
      "Ceiling lift",
      "Not sure yet",
    ]),
    building: z.enum(["Home", "Business or public building", "Other"]),
    city: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(100),
    email: z.email().max(150),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[0-9+().\-\s]*$/)
      .default(""),
    details: z.string().trim().max(1500).default(""),
    sourcePage: z
      .string()
      .max(200)
      .regex(/^\/(?!\/)[a-z0-9/-]*$/),
    contactConsent: z.literal(true),
    emailUpdates: z.boolean().default(false),
    audience: z.enum([
      "homeowner",
      "commercial",
      "builder",
      "architect",
      "other-professional",
      "not-sure",
    ]),
    professionalRole: z
      .enum([
        "gc",
        "builder",
        "architect",
        "designer",
        "developer-owner",
        "property-facility-manager",
        "other-professional",
      ])
      .optional(),
    projectStage: z
      .enum([
        "research",
        "planning",
        "design",
        "bidding",
        "site-preparation",
        "equipment-selection",
        "ready-for-quote",
        "existing-equipment-service",
        "not-sure",
      ])
      .optional(),
    requestPurpose: z
      .enum([
        "evaluation",
        "project-quote",
        "scope-coordination",
        "product-spec-information",
        "installation-coordination",
        "service",
        "general-planning",
      ])
      .optional(),
    organizationName: z.string().trim().max(200).optional(),
    timeline: z.string().trim().max(120).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      ["builder", "architect", "other-professional"].includes(value.audience)
    ) {
      for (const key of ["professionalRole", "projectStage"] as const) {
        if (!value[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required for professional inquiries.",
          });
      }
    }
  });

export type FrlWebInquiry = z.infer<typeof FrlWebInquirySchema>;
