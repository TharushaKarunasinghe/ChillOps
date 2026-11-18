import { z } from 'zod';

export const USER_ROLES = [
  'ops',
  'technician',
  'finance',
  'storekeeper',
  'director',
] as const;
export const roleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof roleSchema>;
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));
export const passwordSchema = z
  .string()
  .transform((value) => value.normalize('NFC'))
  .refine(
    (value) => [...value].length >= 12 && [...value].length <= 128,
    'Password must be 12 to 128 characters.',
  );
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});
export const logoutSchema = z.strictObject({});
export const createUserSchema = loginSchema.extend({
  fullName: z.string().trim().min(1).max(200),
  role: roleSchema,
});
export const publicUserSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.email(),
  role: roleSchema,
});
export type PublicUser = z.infer<typeof publicUserSchema>;
export const authResponseSchema = z.object({ user: publicUserSchema });
export const ipSchema = z.union([z.ipv4(), z.ipv6()]);
