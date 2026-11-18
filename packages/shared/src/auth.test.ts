import { describe, expect, it } from 'vitest';
import {
  createUserSchema,
  loginSchema,
  passwordSchema,
  USER_ROLES,
} from './auth';

describe('authentication validation', () => {
  it('accepts all roles and normalizes email', () => {
    for (const role of USER_ROLES)
      expect(
        createUserSchema.parse({
          fullName: ' Fictional Operator ',
          email: ' TEST@EXAMPLE.INVALID ',
          password: 'abcdefghijkl',
          role,
        }),
      ).toMatchObject({
        fullName: 'Fictional Operator',
        email: 'test@example.invalid',
        role,
      });
  });
  it('normalizes NFC and counts Unicode characters without composition rules', () => {
    expect(passwordSchema.parse('e\u0301'.repeat(12))).toBe('é'.repeat(12));
    expect(passwordSchema.safeParse('😀'.repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
    expect(passwordSchema.parse(' '.repeat(12))).toBe(' '.repeat(12));
  });
  it('rejects unknown fields, invalid email, empty names and invalid roles', () => {
    expect(
      loginSchema.safeParse({ email: 'invalid', password: 'abcdefghijkl' })
        .success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        email: 'a@example.invalid',
        password: 'abcdefghijkl',
        admin: true,
      }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({
        email: 'a@example.invalid',
        password: 'abcdefghijkl',
        fullName: '',
        role: 'admin',
      }).success,
    ).toBe(false);
  });
});
