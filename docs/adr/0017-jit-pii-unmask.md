# ADR-0017: Just-in-Time PII Unmask with Dual Control

- **Status:** Accepted
- **Date:** 2026-03-12
- **Deciders:** CISO (acting), Compliance Lead, Head of Engineering
- **Supersedes:** —

## Context

Operators (underwriters, fraud reviewers, support, compliance) need
PII access to do their jobs — read an SSN to resolve an identity
discrepancy, see a full address to investigate a SAR, look at an
applicant's email to triage a complaint. Standing PII access for every
operator is the wrong default; the cost of an insider event scales
with how many people can read NPI at any moment.

The GLBA Safeguards Rule § 314.4(c) requires "controls over access to
customer information," and partner-bank audits ask the question
explicitly: "who can read customer SSN, and what is your evidence
trail?"

## Decision

**No standing PII reads.** Every plaintext NPI read goes through a
just-in-time unmask flow:

1. The operator opens an application detail and clicks **Request
   unmask** next to a masked field (e.g. `•••-••-1284`).
2. They choose one or more fields, a `PiiUnmaskReasonCode` from a
   bounded enum, and write a free-text reason (≥ 30 characters).
3. The request is written to `PiiUnmaskRequest` with status
   `pending_approval`.
4. A **second admin** — never the requester — receives the request in
   their queue. They approve or reject. Approval grants access for
   **30 minutes**, capped at the fields requested.
5. While the grant is active, the requester sees a "Reveal" button on
   the masked field. **Every reveal click writes a separate audit
   event** with the reading operator's id, the field, and the request
   id; the operator does not get unlimited reads inside the window.
6. At T+30m the grant auto-revokes. Beyond that, the next read needs
   a fresh request.

The flow is enforced server-side. The `MaskedField` UI component is a
convenience layer, not a security boundary; the API refuses to return
plaintext on any masked path without a valid unmask grant.

### Reason-code taxonomy

| Code                         | Use                                            |
| ---------------------------- | ---------------------------------------------- |
| `manual_underwriting_review` | UW analyst working an application              |
| `fraud_investigation`        | Risk team investigating velocity / device flag |
| `customer_service_request`   | Customer asked us to confirm what's on file    |
| `compliance_review`          | SAR, OFAC match, audit response                |
| `legal_request`              | Subpoena / discovery / regulator demand        |
| `reportable_matter_filing`   | Filing a SAR / CTR / breach notice             |
| `notice_re_render`           | Re-rendering an Adverse Action / TILA notice   |

New reason codes require an ADR amendment + Compliance signoff.

### Dual-control on the unmask UI side

The approval queue surfaces request meta-data but the approver does
not see plaintext. The approver's only decision is: did the requester
state a credible reason consistent with the operator's role and the
applicant's context? Approving an unmask never reveals NPI to the
approver.

### Exception: in-product self-service

Consumers viewing their own data don't go through this flow. The
audit-relevant rule is operator → consumer, not consumer → self.

## Alternatives considered

- **Role-based standing access.** Common pattern, low-friction, high
  blast radius. Rejected as the default; we keep a tiny set of
  break-glass admin accounts for incident response only, with
  per-minute monitoring on usage.
- **Self-approved unmask with audit only.** Insufficient — gives
  cover but doesn't deter, and external auditors mark it as a
  finding.
- **External vault tokens + per-call decrypt.** Equivalent
  cryptographically but adds a critical-path third-party. We chose
  to build the access-control surface here and keep crypto local.

## Consequences

- Easier: SOC 2 access-control evidence. The unmask audit log is the
  evidence pack.
- Easier: insider-risk story. We can quote a number to a regulator:
  "X unmasks, Y approvers, Z reads, all within retention."
- Easier: complaint response. Every consumer "did you look at my
  data?" question is answerable with a query.
- Harder: operator UX. A first-time unmask adds ~1 minute of friction.
  We've judged this acceptable for the protection it provides.
- Harder: build & ops. The Admin Console + the API + the audit chain
  all share a small data contract; changes here touch all three.

## Compliance / risk notes

- **GLBA Safeguards § 314.4(c)(1)–(2):** access controls + dual
  authorization for sensitive actions. ✓
- **SOC 2 CC6.3:** access-rights provisioning, modification, removal,
  and review. ✓
- **NYDFS Part 500.7:** access privileges minimization. ✓
- **HIPAA-equivalent posture** (we are not a Covered Entity, but the
  pattern satisfies HIPAA minimum-necessary if we ever cross into
  PHI). ✓
- **Bank-partner audit:** every audit pack we've reviewed asks the
  insider-risk question; this ADR is the answer.

Engineers shipping a new path that reads NPI must do so through
`PiiVaultService.read(...)`, which fails closed when no valid grant
exists. Bypassing the vault is a SEV-1 ticket on the offender's name.
