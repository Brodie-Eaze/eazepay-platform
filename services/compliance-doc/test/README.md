# Compliance-doc service — characterisation tests

Reg B / FCRA Adverse Action Notice generator. Tests pin both the legal
content (verbatim ECOA + §615(a) blocks) and the operational pipeline
(idempotency, supersede flow, 25-month retention, AAN delivery
notification fan-out).

## Running

```bash
npx vitest run --root services/compliance-doc
npx vitest run --root services/compliance-doc --coverage

# Refresh PDF length golden after an intentional content change:
UPDATE_GOLDEN=1 npx vitest run --root services/compliance-doc test/adverse-action-pdf.spec.ts
```

Branch coverage: **82%**.

## What's covered

| Module | Spec file |
| --- | --- |
| `notices/adverse-action-builder.ts` | `adverse-action-builder.spec.ts` — every documented Reg B / FCRA reason code resolves; unknown codes throw (fail-closed); bureau optional; policyVersion stamped verbatim |
| `notices/adverse-action.types.ts` + `services/admin/reason-codes.ts` | `reason-code-taxonomy.spec.ts` — single source of truth: AAN codes live in `@eazepay/service-admin`; risk policy codes (`services/risk/policy.ts`) are a SEPARATE taxonomy and must never leak onto a consumer notice |
| `render/adverse-action-pdf.ts` | `adverse-action-pdf.spec.ts` — `%PDF-` header, Info dict (Title / Subject / Author) objects, bureau block increases byte-length by ≥500B, ±15% length golden, deterministic across runs given fixed `generatedAt` |
| `compliance-doc.service.ts` | `compliance-doc-service.spec.ts` — first-call render+persist+audit; idempotency on (Application, adverse_action_notice, status=active); supersede flow flips prior + emits `…regenerated` audit; refuses non-`declined` apps or empty `declineReasonCodes`; bureau (§615(a)) flow; AAN notification fan-out via NotifyPort; 25-month retention stamp |

## Adding a new case

1. Use `makeFakePrisma({ application, existingDoc? })` to set up DB
   state. The fake transactionally simulates updateMany + create.
2. Use `makeFakeStorage()` to capture `put()` calls. The Buffer body is
   available at `storage.puts[0].body` for sniffing.
3. For PDF content assertions: pdfkit compresses page-content streams,
   so visible body text is NOT scannable in the byte stream. Pin Info
   dict fields and length deltas; the builder spec covers verbatim
   regulatory text presence.

## Behaviours called for in the spec but NOT yet in legacy (todo)

Two tests are recorded as `it.todo` so the rewrite has a target:

- **`aan_due_by = decisioned_at + 30d`** — Reg B requires AAN delivery
  within 30 days of adverse action. The legacy `compliance-doc` does
  not stamp the deadline on the Application or Document; today the
  notification cron is the de-facto enforcer. The rewrite should add
  the field and pin it.

- **≥4 reason-code hard cap** — Reg B §1002.9(b)(2) specificity
  protection. The legacy builder accepts any list length without
  capping at 4. The rewrite should enforce the cap at the builder
  layer (`buildAdverseActionNotice` throws if `reasonCodes.length > 4`).

Both are flagged with `it.todo()` rather than deleted — they fail in
the IDE but do not break CI, and re-implementing them is a one-line
change from `.todo` to `.it` + an assertion.
