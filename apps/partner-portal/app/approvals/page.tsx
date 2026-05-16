import { redirect } from 'next/navigation';

/**
 * Merchant Approvals collapsed into Business Onboarding.
 *
 * The two surfaces overlapped: the onboarding pipeline already exposes
 * every approval state (intake → reviewing → approved → live), and
 * having a separate "Merchant Approvals" menu duplicated the approve
 * step. Anyone hitting the old `/approvals` route lands on the
 * pipeline at the equivalent column.
 *
 * Keep this redirect file (rather than deleting the route) so any
 * deep-link in old emails, dashboards, or browser history continues to
 * resolve to a live page.
 */
export default function ApprovalsRedirect() {
  redirect('/onboarding-pipeline');
}
