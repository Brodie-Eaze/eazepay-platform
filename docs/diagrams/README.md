# Architecture diagrams

Four Mermaid diagrams that document the EazePay / CoachPay consumer
financing flow end-to-end. Each renders natively in GitHub, Notion,
Linear, VS Code Markdown preview, and most modern docs tools.

| Diagram                                                        | When to look at it                                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`consumer-application-flow.md`](consumer-application-flow.md) | First. The end-to-end sequence from "applicant lands on /apply" to "lender disburses funds." Onboards any engineer in 5 minutes.                           |
| [`system-topology.md`](system-topology.md)                     | Static component map. What service talks to what. Trust boundaries. Where PII crosses the network.                                                         |
| [`application-state-machine.md`](application-state-machine.md) | Lifecycle of an Application. Every state, every transition, every terminal failure mode.                                                                   |
| [`pii-dataflow.md`](pii-dataflow.md)                           | Where PII enters, where it's encrypted, who can read it, retention. Required reading for SOC 2 + any engineer touching ConsumerProfile / HighsaleSnapshot. |

## The 7 architectural decisions these diagrams encode

| #   | Decision                            | Pick                                                                           | Why                                                                                                                                       |
| --- | ----------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Highsale + True Topia handoff shape | **Case A — data only** (credit tier + financial enrichment, no lender routing) | Routing IP stays in-house. Their decision engine is calibrated to their lender set, not ours.                                             |
| 2   | Consumer apply surface              | **`apps/consumer-web`**                                                        | Isolated blast radius. Separate CSP. Separate scaling profile. A partner-portal incident cannot take down applications.                   |
| 3   | Submit → offers handoff             | **Async + poll**                                                               | Better UX (lenders appear as they quote), more forgiving on slow lenders, already 80% wired from Wave 2B.                                 |
| 4   | e-Sign provider                     | **DocuSign (embedded)**                                                        | Mature SDK, embeddable widget, the compliance audit trail US regulators expect.                                                           |
| 5   | Disbursement trigger                | **Lender → apps/api webhook**                                                  | Real-time, single source of truth, audit trail in one place. Polling only as per-adapter fallback when a lender doesn't support webhooks. |
| 6   | All-decline UX                      | **"You'll receive a written notice within 30 days" + soft retry CTA**          | FCRA-compliant minimum, doesn't shame the applicant, doesn't create downstream liability.                                                 |
| 7   | Offer ranking rule                  | **Lowest total cost to the consumer**                                          | ECOA / Reg B fair-lending defensible. Counsel-blessed. Lender-paid placement never affects rank.                                          |

## How to edit

These are Markdown files containing Mermaid code blocks. Edit the
Markdown source — every modern preview tool re-renders automatically.
PNG / SVG export is one command (`mmdc -i input.md -o output.svg`) if
you need to slap them in a slide deck.

When the architecture changes, edit the diagram in the same PR as the
code change. Stale diagrams are worse than no diagrams.

## Reading order for a new engineer

1. Read `consumer-application-flow.md` once. Don't worry about details.
2. Read `system-topology.md` to see where each step lives.
3. Read `application-state-machine.md` to see what state the system is in at each step.
4. Read `pii-dataflow.md` before writing any code that touches PII.
5. Cross-reference with [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for the wider platform context.
