/**
 * Loose-shape JSONB column schemas.
 *
 * For columns where the persisted shape is operator-controlled,
 * fast-evolving, or genuinely free-form, we keep the Zod schema
 * permissive — `z.record(z.string(), z.unknown())` — and let the
 * concrete consumer narrow at the call site.
 *
 * Why permissive: forcing a strict object schema on
 * `vertical_configs.routing_rules_json` or
 * `lenders.eligibility_rules_json` would either (a) require a schema
 * change every time an operator added a rule key, or (b) silently
 * drop fields on read. Both are worse than "validate it's an object,
 * trust the writer."
 *
 * The strict app-layer schemas live next to their consumers (e.g.
 * the decision engine validates eligibility-rule keys it actually
 * inspects). This file is the catch-all for the storage boundary.
 *
 * Columns covered:
 *  - audit_log.payload_json
 *  - vertical_configs.routing_rules_json
 *  - vertical_configs.eligibility_rules_json
 *  - vertical_configs.branding_json
 *  - vertical_configs.economics_json
 *  - mids.provisioning_state_json
 *  - mids.rate_card_json
 *  - lenders.eligibility_rules_json
 */

import { z } from 'zod';

/** Generic JSONB object — any key, any value. Not exported as
 *  permission to skip validation; exported as the "the writer owns
 *  the shape" contract. */
export const JsonObjectSchema = z.record(z.string(), z.unknown());
export type JsonObject = z.infer<typeof JsonObjectSchema>;

/** Generic JSONB value — object, array, primitive, or null. Used
 *  where the column genuinely accepts any JSON. */
export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);
export type JsonValue = z.infer<typeof JsonValueSchema>;

/* ---------- per-column aliases for grep-ability ---------- */

export const AuditLogPayloadSchema = JsonObjectSchema;
export type AuditLogPayload = JsonObject;

export const RoutingRulesSchema = JsonObjectSchema;
export const EligibilityRulesSchema = JsonObjectSchema;
export const BrandingSchema = JsonObjectSchema;
export const EconomicsSchema = JsonObjectSchema;
export const MidProvisioningStateSchema = JsonObjectSchema;
export const RateCardSchema = JsonObjectSchema;
export const LenderEligibilityRulesSchema = JsonObjectSchema;
