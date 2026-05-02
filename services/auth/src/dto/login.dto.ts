import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z.object({
  identifier: z.string().min(3).max(254), // email or E.164 phone — normalised in service
  password: z.string().min(1).max(128),
  deviceId: z.string().min(8).max(128),
});

export class LoginDto extends createZodDto(LoginSchema) {}
