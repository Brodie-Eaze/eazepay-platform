# Notification service — characterisation tests

Tests pin the legacy NotificationService dispatch pipeline so a rewrite
(e.g. swap from inline Promise.all to a queue, or split per-channel
adapters into their own services) can be proven equivalent.

## Running

```bash
npx vitest run --root services/notification
npx vitest run --root services/notification --coverage
```

Branch coverage: **94%**.

## What's covered

| Module | Spec file |
| --- | --- |
| `templates/registry.ts` | `template-registry.spec.ts` — every documented MVP template key, per-template channel list, render output for `application.funded` / `offers_presented` / `declined` / `payment.repayment.failed` |
| `adapters/console-channel.adapter.ts` | `console-adapters.spec.ts` — email/sms/push/in_app stubs each bind the right `channel` and emit `console-…` / `in_app-…` provider refs |
| `notification.service.ts` | `notification-service.spec.ts` — email resolves user.email, sms/push resolve phoneE164, in_app skips destination check, missing-address rows record `status='suppressed'` + `failureReason='no_destination'`, adapter throw → `status='failed'` + `failureReason='adapter_exception'`, channels override honoured, unknown template returns silently, idempotency contract pinned at "no service-layer dedup" |

## Adding a new case

1. Define inputs in a `makeFakePrisma({ email, phoneE164 })` block.
2. Wire only the channel adapters relevant to the assertion.
3. Call `svc.notify({ userId, templateKey, payload, channels? })`.
4. Assert against `prisma.rows` and the adapter spy `mock.calls`.

## Behaviours not yet implemented (todo)

None at present. The "idempotency on duplicate-row redeliveries" spec is
characterised in `notification-service.spec.ts` as a *negative*
assertion: the service does NOT itself dedupe — the outbox-dispatcher
contract supplies that property via a DB unique constraint. If a future
rewrite moves dedup into the service, that test must flip and the
contract should be documented in `notify.port.ts`.
