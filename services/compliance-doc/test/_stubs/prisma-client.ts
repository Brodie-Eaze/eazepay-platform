// Test-only stub for `@prisma/client`. We never connect to a database
// in unit tests; the compliance-doc service receives a fake PrismaClient
// from the test fixtures. This stub exists so source files that
// `import { PrismaClient } from '@prisma/client'` (type-only or runtime)
// can be loaded by Vitest without the generated `.prisma/client/default`
// runtime being present.
export class PrismaClient {}
const noopEnum = new Proxy({}, { get: (_t, p) => String(p) }) as Record<string, string>;
export const LenderTier = noopEnum;
export const LoanCategory = noopEnum;
export const NotificationChannel = noopEnum;
export const Prisma = { Decimal: Number };
export default { PrismaClient };
