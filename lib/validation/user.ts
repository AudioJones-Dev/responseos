import { z } from "zod";
import { e164PhoneSchema, idSchema } from "./common";

export const UserRoleSchema = z.enum([
  "aj_admin",
  "operator",
  "client_admin",
  "client_viewer",
]);
export type UserRoleValidated = z.infer<typeof UserRoleSchema>;

export const CreateUserInputSchema = z.object({
  account_id: idSchema.optional(),
  role: UserRoleSchema,
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: e164PhoneSchema.optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateRoleInputSchema = z.object({
  user_id: idSchema,
  role: UserRoleSchema,
});
export type UpdateRoleInput = z.infer<typeof UpdateRoleInputSchema>;
