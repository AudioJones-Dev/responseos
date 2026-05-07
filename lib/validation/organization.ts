import { z } from "zod";
import { e164PhoneSchema, isoDateSchema, idSchema } from "./common";

export const OrganizationStatusSchema = z.enum([
  "lead",
  "active",
  "paused",
  "cancelled",
]);

export const CreateOrganizationInputSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  industry: z.string().min(1).max(80),
  website_url: z.string().url().optional(),
  primary_phone: e164PhoneSchema.optional(),
  timezone: z.string().min(1),
  status: OrganizationStatusSchema.optional(),
});
export type CreateOrganizationInput = z.infer<
  typeof CreateOrganizationInputSchema
>;

export const UpdateOrganizationInputSchema = CreateOrganizationInputSchema.partial().extend({
  id: idSchema,
});
export type UpdateOrganizationInput = z.infer<
  typeof UpdateOrganizationInputSchema
>;

export const OrganizationSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  industry: z.string(),
  website_url: z.string().nullable().optional(),
  primary_phone: z.string().nullable().optional(),
  timezone: z.string(),
  status: OrganizationStatusSchema,
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});
export type ValidatedOrganization = z.infer<typeof OrganizationSchema>;
