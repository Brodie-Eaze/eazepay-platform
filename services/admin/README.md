# @eazepay/service-admin

Admin queue + decline override + JIT PII unmask + marketplace + team.

## Responsibilities

- Maintain the application-review queue (filter, claim, decision)
- Decline override workflow with Reg B / FCRA reason codes and
  dual-control on amounts ≥ $25k
- Just-in-time PII unmask requests with second-admin approval +
  per-read audit row
- Internal team / role management
- Marketplace (lender) management surfaces

## Public API

- `AdminModule.forRoot(...)`
- `AdminService` — queue claim, override, unmask request lifecycle
- `TeamService` — invites, role assignment
- `MarketplaceService` — lender marketplace ops
- Controllers: `/v1/admin/*`, `/v1/admin/team/*`, `/v1/admin/marketplace/*`
- `reason-codes.ts` — canonical override reason taxonomy

## Dependencies

- `@eazepay/service-auth`, `@eazepay/service-compliance-doc`,
  `@eazepay/service-notification`, `@eazepay/service-user`
- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma)

## Notes

- Dual control is enforced at the service layer, not the UI — even a
  direct API caller cannot bypass the second approver
- Every PII unmask writes both the request *and* the eventual read to
  audit, with the approving admin id stamped on the read row
- Reason codes mirror `@eazepay/service-risk`'s taxonomy for
  cross-system consistency
