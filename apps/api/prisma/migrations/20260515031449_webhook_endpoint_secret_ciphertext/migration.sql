-- Add the AES-256-GCM envelope of the raw webhook signing secret to
-- `webhook_endpoints`. Pre-existing rows keep only `secret_hash` and
-- will fail dispatch (by design) until the merchant rotates the secret,
-- at which point `secret_ciphertext` is populated by WebhookService.
--
-- See dispatcher.service.ts → `attempt()` for the unmigrated-row path
-- (lastError = 'endpoint_secret_unmigrated_rotate_required', counts toward
-- the consecutive-failure circuit breaker).
ALTER TABLE "webhook_endpoints"
  ADD COLUMN "secret_ciphertext" TEXT;
