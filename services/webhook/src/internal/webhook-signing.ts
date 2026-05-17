import { createHmac } from 'node:crypto';

/**
 * AAD context for a webhook endpoint's signing secret envelope.
 *
 * The PiiVaultService opaque envelope binds ciphertext to this exact
 * shape — a ciphertext sealed for endpoint A cannot be lifted into
 * endpoint B's row, because the AAD differs and the GCM auth tag will
 * fail to verify. Centralised here so the seal site (WebhookService)
 * and the open site (WebhookDispatcher) cannot drift.
 */
export const webhookSecretAadContext = (
  endpointId: string,
): { scope: string; endpointId: string } => ({
  scope: 'webhook_endpoint_secret',
  endpointId,
});

/**
 * Compute the outbound webhook HMAC signature.
 *
 * Contract (mirrors the inbound Highsale verifier and Stripe / Square):
 *   header `x-eazepay-signature: sha256=<hex>`
 *   value  = HMAC-SHA256(secret, `<timestamp>.<bodyJson>`)
 *
 * The timestamp is sent in the separate `x-eazepay-timestamp` header so
 * the merchant can enforce a freshness window when verifying — that's
 * what stops a captured request body from being replayed indefinitely.
 */
export const computeSignature = (secret: string, timestamp: number, bodyJson: string): string =>
  createHmac('sha256', secret).update(`${timestamp}.${bodyJson}`).digest('hex');
