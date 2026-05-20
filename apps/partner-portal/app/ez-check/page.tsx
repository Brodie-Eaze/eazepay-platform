/**
 * EZ Check root — canonical entry point for the standalone product.
 *
 * Redirects to /landing/ez-check (the public marketing landing) so the
 * bare URL always gives the visitor the properly branded EZ Check
 * surface, never the in-portal Lovable integration-doc card that used
 * to live here. Same pattern as the per-brand /medpay, /tradepay,
 * /coachpay roots that lead to their landing pages.
 *
 * Server-side `redirect()` so there's no client-side flash of unrendered
 * content and crawlers see a clean 307 to the canonical URL.
 */
import { redirect } from 'next/navigation';

export default function EzCheckRoot(): never {
  redirect('/landing/ez-check');
}
