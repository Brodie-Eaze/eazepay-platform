export const PRISMA = Symbol.for('eazepay.prisma');

/**
 * SEC-017 — gate `POST /v1/merchants` behind an admin check outside
 * development. When this provider resolves to `true`, MerchantService
 * verifies that the calling user is `isAdmin=true` before allowing
 * the merchant row to be created. In `development` it stays `false`
 * so seed scripts and local demo flows keep working unchanged.
 */
export const MERCHANT_REGISTRATION_REQUIRES_ADMIN = Symbol.for(
  'eazepay.merchant.registrationRequiresAdmin',
);
