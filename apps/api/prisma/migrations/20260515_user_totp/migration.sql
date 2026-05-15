-- SEC-016 — TOTP second-factor enrolment columns on `users`.
--
-- Threat being closed: SMS / email OTP is vulnerable to SIM-swap and
-- email-account takeover. Both vectors have a documented track record
-- in consumer-finance fraud cases. TOTP delivers a shared-secret
-- second factor whose verification never leaves the user's device.
--
-- Columns:
--   - totp_secret_ciphertext  TEXT NULL
--       Opaque envelope sealed via PiiVaultService.sealOpaque
--       (production) or LocalTotpVaultAdapter (development). The
--       envelope's AAD binds `scope=totp_secret` + this user's id, so
--       a DB dump yields ciphertext only — the KEK is held by the KMS
--       and a row swapped between users fails GCM authentication.
--       NULL means the user has not enrolled TOTP — SMS / email OTP
--       remains the second factor for those accounts.
--
--   - totp_recovery_codes     JSONB NULL
--       Array of {hash: string, used: boolean, usedAt?: string}.
--       Hashes are argon2id with the same work factor as the password
--       column. Each code is a single-use bypass of the TOTP factor
--       (used: true is irreversible). Stored as JSONB so Postgres can
--       enforce well-formed JSON at write time, but never indexed —
--       reads only happen during the verify-totp request.
--
-- Both columns are nullable so the migration is zero-downtime — code
-- that hasn't been deployed yet sees NULL and falls back to the
-- SMS/email OTP path. New writes happen only through the TOTP enrol
-- endpoints, which are themselves throttled at 5/min/IP.
--
-- No index — neither column is filtered on; they're only read by the
-- TOTP verify path which already has the userId.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totp_secret_ciphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "totp_recovery_codes"    JSONB;
