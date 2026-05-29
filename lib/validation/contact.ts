import { z } from "zod";
import { e164PhoneSchema, idSchema } from "./common";

export const ContactSourceSchema = z.enum([
  "call",
  "sms",
  "form",
  "manual",
  "crm_sync",
]);

export const CreateContactInputSchema = z.object({
  account_id: idSchema,
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  phone: e164PhoneSchema.optional(),
  email: z.string().email().optional(),
  address: z.string().max(240).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  zip: z.string().max(20).optional(),
  source: ContactSourceSchema,
});
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;
