# Lender service — characterisation tests

These tests pin what the legacy lender service *actually does today* so a
rewrite can be proven equivalent. The legacy code is the oracle: if a
test asserts `19.27` and a spec says `19.28`, the test stays at `19.27`
and the discrepancy is escalated separately.

## Running

```bash
# From repo root
npx vitest run --root services/lender
npx vitest run --root services/lender --coverage
```

Branch coverage: **98%** (one nullable branch on a scaffold adapter
remains — captured as an inactive code-path note in the source).

## What's covered

| Module | Spec file |
| --- | --- |
| `adapters/buzzpay.adapter.ts` | `buzzpay.adapter.spec.ts` — eligibility envelope (amount, term, affordability), exact quote arithmetic, 30-min offer TTL |
| `adapters/mock-prime.adapter.ts` | `mock-prime.adapter.spec.ts` — tighter eligibility (650 score floor), $25k ceiling, 9.99% APR math |
| `adapters/{us-bank, engine-tech, queen-street}.adapter.ts` | `scaffold-adapters.spec.ts` — `pending_api_credentials` vs `not_implemented` throw behaviour, `isEligible` permissive surface |
| `lender-registry.service.ts` | `lender-registry.spec.ts` — `listEnabled` state/wired-adapter filters, `getAdapter` lookup, prisma where-clause shape |

## Adding a new case

1. Pick the right spec file by module under test.
2. Add the inputs as literal values (cents as `bigint`, not floats).
3. Run once, copy the actual numeric result into the assertion, commit.
4. If a behaviour is expected but not yet implemented in the legacy,
   use `it.todo('...pending RULE-NNN...')` rather than deleting the case.

## Behaviours not yet implemented (todo)

None at present. Scaffold adapters intentionally throw `not_implemented`
once credentials are wired; tests pin both halves of that contract so
the rewrite cannot silently change either.
