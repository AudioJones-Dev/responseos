import { z } from "zod";
import { e164PhoneSchema, isoDateSchema, idSchema } from "./common";

export const AccountStatusSchema = z.enum([
  "lead",
  "active",
  "paused",
  "cancelled",
]);

export const CreateAccountInputSchema = z.object({
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
  status: AccountStatusSchema.optional(),
});
export type CreateAccountInput = z.infer<
  typeof CreateAccountInputSchema
>;

export const UpdateAccountInputSchema = CreateAccountInputSchema.partial().extend({
  id: idSchema,
});
export type UpdateAccountInput = z.infer<
  typeof UpdateAccountInputSchema
>;

export const AccountSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  industry: z.string(),
  website_url: z.string().nullable().optional(),
  primary_phone: z.string().nullable().optional(),
  timezone: z.string(),
  status: AccountStatusSchema,
  created_at: isoDateSchema,
  updated_at: isoDateSchema,
});
export type ValidatedAccount = z.infer<typeof AccountSchema>;
