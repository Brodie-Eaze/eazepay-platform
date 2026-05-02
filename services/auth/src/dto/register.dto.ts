import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { EmailSchema, PhoneE164Schema } from '@eazepay/shared-types';

const PasswordSchema = z
  .string()
  .min(12, 'must be at least 12 characters')
  .max(128)
  .regex(/[A-Z]/, 'must contain an uppercase letter')
  .regex(/[a-z]/, 'must contain a lowercase letter')
  .regex(/[0-9]/, 'must contain a digit')
  .regex(/[^A-Za-z0-9]/, 'must contain a symbol');

export const RegisterSchema = z
  .object({
    email: EmailSchema.optional(),
    phone: PhoneE164Schema.optional(),
    password: PasswordSchema,
    marketingConsent: z.boolean().default(false),
  })
  .refine((v) => v.email !== undefined || v.phone !== undefined, {
    message: 'one of email or phone is required',
    path: ['email'],
  });

export class RegisterDto extends createZodDto(RegisterSchema) {}
