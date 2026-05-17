/** DI tokens for service-billing. Module wires concrete adapters. */
export const PRISMA = Symbol('BILLING_PRISMA');
export const PII_VAULT = Symbol('BILLING_PII_VAULT');
export const ACTIVITY_SOURCE = Symbol('BILLING_ACTIVITY_SOURCE');
export const CONFIRM_TOKEN_TTL_HOURS = Symbol('BILLING_CONFIRM_TOKEN_TTL_HOURS');
