import { redirect } from 'next/navigation';

/**
 * The platform invoices merchants — it does NOT pay them out. The old
 * `/payouts` surface was a misframe; the new surface lives at
 * `/invoices` with vertical-based fee rates (MedPay 3.5%, TradePay 5%,
 * CoachPay 6%, Multi-brand 4.5%).
 *
 * Kept this file as a redirect so any deep link, bookmark, or
 * cross-page reference still resolves.
 */
export default function PayoutsRedirect() {
  redirect('/invoices');
}
