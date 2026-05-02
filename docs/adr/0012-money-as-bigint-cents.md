# ADR-0012: Money is integer cents (BigInt), serialised as string-of-integer

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Brodie

## Context

Money math + JSON have a 30-year history of bad outcomes: float
rounding errors at the cent boundary, JSON's lack of BigInt,
language-cross-boundary precision loss (Postgres NUMERIC →
JavaScript Number), and the eternal "$10 is 10 dollars or 10
cents" off-by-100.

## Decision

**On disk:** every monetary column is `BigInt` cents. No `numeric`,
no `decimal`, no float. Postgres column type is `BIGINT`.

**In code:** branded `Cents` type in `@eazepay/shared-types`. Math
goes through `addMoney` / `subMoney` helpers that throw on
currency mismatch.

**On the wire:** every JSON field is the **string of an integer**.
`BigInt.prototype.toJSON` is installed once in `apps/api/src/main.ts`
so Fastify serialises automatically. The OpenAPI / api-client
contract documents money fields as `string` typed.

## Alternatives considered

- **`number` (JavaScript Number)** — rejected. 9 quadrillion-cent
  ceiling on safe integers (~$90 trillion) is fine in isolation,
  but float math creeps in via libraries / spreadsheets / CSV
  exports and we lose the safety guarantee.
- **`Decimal` / decimal.js** — rejected. Adds a dep, doesn't help
  the wire-format problem, and BigInt is now native.
- **Number for under-$1 amounts only, BigInt for above** —
  rejected. Two paths is two bugs.

## Consequences

- Serialiser handling is uniform — `BigInt.prototype.toJSON`
  globally + a documented contract that money fields are strings.
- Frontends parse to `Number` when they need to display, never
  when they need to compute. (Mobile / web only display in the
  consumer apps; computation lives server-side.)
- Client SDKs in non-JS languages (Python, Ruby, PHP) get
  `string` and parse to their native Decimal / int128. No
  precision loss.

## Compliance / risk notes

Money math errors that round in the bank's favor are usually
material findings; rounding in the consumer's favor is usually a
write-off but still a finding. Floats produce both. BigInt cents
removes the floor.
