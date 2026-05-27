-- ============================================================
-- 0010_welcome_tokens — single-use, expiring tokens for the
-- /welcome/<brand>?t=<token> set-password flow + future password
-- reset flow.
--
-- SEC-201 closure: prior to this migration the welcome URL embedded
-- the raw userId (`?u=<userId>`). Combined with /api/account/set-password
-- accepting `{userId, newPassword}` with no token/current-password
-- check, anyone who ever observed the welcome URL could permanently
-- take over the account. Tokens fix that: the URL carries a 32-byte
-- hex token, the token is single-use (consumed_at flips on the
-- successful POST), and the token expires.
--
-- Schema notes:
--   - `token` is the PK (32-byte hex string from crypto.randomBytes).
--     Caller writes the hex value into the URL; database row stores
--     the same value. We don't hash because the token IS the secret
--     (high-entropy random) AND it's a single-use credential; the
--     DB compromise threat model gives an attacker the user table
--     anyway.
--   - `kind` discriminates 'welcome' vs 'reset' so the same table
--     serves both flows; the consume function asserts the kind the
--     caller expects.
--   - `consumed_at` is the atomic single-use flag. The consume
--     helper does `UPDATE ... SET consumed_at = now() WHERE
--     consumed_at IS NULL RETURNING user_id, kind` — Postgres
--     guarantees only one concurrent UPDATE wins.
--   - Index on (user_id, kind, consumed_at) supports the "is there a
--     live unconsumed token for this user?" lookup the reissue path
--     will want when we add resend-welcome support.
--
-- Idempotent: all statements use IF NOT EXISTS so a half-applied
-- migration can be safely re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS "welcome_tokens" (
  "token" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('welcome', 'reset')),
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "welcome_tokens_user_kind_consumed_idx"
  ON "welcome_tokens" ("user_id", "kind", "consumed_at");
