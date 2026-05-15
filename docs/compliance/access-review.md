# Quarterly access review

> SOC 2 CC6.2, CC6.3 — Logical access provisioning and review.
> Cadence: every 90 days. Owner: CCO + Engineering lead.
> Last reviewed: 2026-05-15.

## Purpose

Confirm that every human account with access to EazePay production
systems is still needed, and that the access level is still the
minimum required for the role.

## Scope of accounts reviewed

Each quarter, the reviewer walks four lists in order:

1. **Engineers** — GitHub org members + Railway prod environment
   members + Postgres prod read/write users.
2. **Operators** — Partner-portal accounts with `admin` or
   `accountant` role; PII reveal permission (`pii:reveal:request`).
3. **Contractors** — Any non-employee with credentials to any system
   above. Reviewed with extra scrutiny — default action is revoke
   unless an active engagement is documented.
4. **Service accounts** — Long-lived API keys (Highsale partner key,
   lender adapter creds). Listed for completeness; reviewed by
   Engineering, not HR.

## Review template

Filled out by the reviewer each quarter. Stored in
`docs/compliance/access-reviews/YYYY-Q<N>.md` (one file per quarter,
git-versioned).

```
Quarter: ____
Review date: ____
Reviewer: ____

For each account:

| Identity | System | Role / scope | Last login | Last reviewed | Justification | Action |
|---|---|---|---|---|---|---|

Action values: keep / downscope / revoke.
A "revoke" line MUST be followed up within 5 business days; the
quarterly review file is updated with the revocation timestamp.
```

## Account-type detail (human-actor types currently in scope)

| Account type                         | Where it lives                        | Provisioning trigger                      | De-provisioning trigger                   |
| ------------------------------------ | ------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Engineer — GitHub                    | `eazepay/*` org                       | Hiring confirmation from CCO              | Termination + 24 h                        |
| Engineer — Railway prod              | Railway team                          | Engineer joins the prod-on-call rotation  | Leaves the rotation OR termination        |
| Engineer — Postgres prod             | Direct DB user (read-only by default) | Approved JIT request via Engineering lead | Approval window expires (max 30 days)     |
| Operator — Partner portal admin      | `User` table, `role='admin'`          | Onboarded by CCO                          | CCO disables in admin console             |
| Operator — Partner portal accountant | `User` table, `role='accountant'`     | Onboarded by CCO                          | CCO disables in admin console             |
| Operator — PII reveal                | Permission grant on top of role       | Joint approval CCO + Engineering          | Quarterly review OR after 90 d of non-use |
| Contractor — any of the above        | Same as employee role + 90-day max    | Statement of work on file                 | SoW end date OR 90 days, whichever first  |

## Quarterly checklist for the reviewer

- [ ] Pull GitHub org member list; cross-reference vs HR active list.
- [ ] Pull Railway prod members.
- [ ] Pull Postgres prod user list (`SELECT usename FROM pg_user`).
- [ ] Pull `User` table rows where `role IN ('admin', 'accountant')`.
- [ ] Pull `User` table rows where `permissions ?| array['pii:reveal:request', 'pii:reveal:approve']`.
- [ ] For each row, fill the template above.
- [ ] Action all `revoke` rows within 5 business days; record
      timestamps in the quarterly review file.
- [ ] Commit the quarterly review file to git; CCO countersigns by
      creating a signed git tag `access-review-YYYY-QN`.
