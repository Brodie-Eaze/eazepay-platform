# ADR-0024: Resource ownership mismatch returns 404, not 403

**Status:** Accepted
**Date:** 2026-05-26
**Deciders:** Brodie + Builder Council

## Context

Builder H replaced the ownership-check stub
(`assertResourceOwnership` in `lib/server-guards.ts`) with a real
implementation. Every protected resource — applications, offers,
contracts, MIDs, settlements — has an owning `partner_id` /
`organization_id`. When an authenticated caller hits an endpoint for
a resource owned by a _different_ tenant, we have to choose what to
return.

The natural answer for a non-security person is `403 Forbidden` —
"you're authenticated but not authorised for this." That is wrong in
a multi-tenant fintech. `403` versus `404` is observable from the
outside, so it leaks **existence**. An attacker holding an API key
for partner A who wants to discover whether application `abc123`
exists in partner B's pipeline (a real, valuable signal in a
competitive lender market) can simply `GET /v1/applications/abc123`
and watch the response code: `403` means "exists, not yours" and
`404` means "doesn't exist anywhere." Once existence is known, side
channels like timing and rate-limit responses leak more.

The same shape applies in reverse: an attacker who has compromised
one partner's API key can enumerate the global ID space to map the
shape of competing pipelines.

We have a multi-tenant promise — _no partner can learn anything
about another partner's data, including its existence_ — and the
status-code choice is one of the load-bearing pieces of that
promise.

## Decision

`assertResourceOwnership(resource, ctx)` returns `404 not_found`
when:

- The resource does not exist, **or**
- The resource exists but `resource.organizationId !== ctx.orgId`.

Both branches emit the same RFC-7807 problem document (per
ADR-0014), the same response headers, and the same correlation ID
shape. The only place the two branches differ is in the **server
log line**, which records `reason: 'not_owned'` or
`reason: 'not_found'` for support to inspect. There is no public
API surface that distinguishes the two.

`403 Forbidden` is reserved for the case where the caller is
authenticated but the **action** is forbidden inside their own
tenant — e.g. a read-only API key trying to POST, or a session in
`demo` mode trying to hit an operator route. That is fundamentally
different from "this resource belongs to someone else."

## Options considered

1. **Return 403 on ownership mismatch** — what most CRUD frameworks
   do by default. Rejected: leaks resource existence across
   tenants. The "feels wrong" reaction to this option is exactly
   the design flaw — it makes sense to the developer because the
   developer can see the resource exists, but the API surface
   shouldn't.
2. **Return 404 on ownership mismatch** _(chosen)_ — symmetric with
   "doesn't exist." Closes the enumeration channel. The minor UX
   cost is that a legitimate user who types the wrong ID gets a
   slightly worse error message.
3. **Return 403 with a generic body** — looks symmetric but the
   status code itself is the leak. Doesn't solve the problem.
4. **Return 401 (Unauthorized)** — wrong semantically (caller _is_
   authenticated) and would invite clients to re-auth on a path
   that has nothing to do with credentials.
5. **Return 451 / 410 / a custom code** — even more leak; any
   distinct response signals existence.

## Consequences

**Positive:**

- No public-API path leaks the existence of another tenant's
  resources.
- Single, symmetric error shape for the entire "I can't see this"
  family of cases. Easier for client SDKs to handle.
- Defensible posture in a tenant-isolation audit: the same status
  code for "doesn't exist" and "not yours" is industry standard for
  multi-tenant SaaS (Stripe, GitHub Enterprise, Linear all do this).

**Negative / accepted trade-offs:**

- Worse UX for a legitimate user who mistypes a resource ID — they
  get `404 not_found` rather than a more helpful "this resource
  belongs to a different account." Mitigated by the server-side log
  with `reason: 'not_owned'`, which support can grep when a partner
  opens "I'm getting a 404 on what I think is my application."
- Slightly harder for client devs to debug their own integration
  bugs (e.g. they paste a sandbox ID into a prod call). Mitigated
  by the response correlation ID — they can quote it to support and
  we look it up.
- The asymmetry between "ownership mismatch → 404" and "action
  forbidden → 403" has to be documented in the API reference or
  client SDKs will misuse the error codes. The contributor guide
  documents it; the integration tests assert it.

**Reversibility:** Easy at the code level, hard at the contract
level. Flipping `assertResourceOwnership` to return 403 is two
lines. Doing so for callers in production would be a breaking
change to API consumers' error handling and would require a
deprecation cycle.

## References

- `apps/partner-portal/lib/server-guards.ts` —
  `assertResourceOwnership`
- `apps/partner-portal/lib/server-guards.spec.ts`
- ADR-0014 (RFC-7807 problem details — error body shape)
- ADR-0010 (modular monolith — same auth posture in every module)
