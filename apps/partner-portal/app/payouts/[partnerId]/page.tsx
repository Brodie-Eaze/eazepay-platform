'use client';
import { useParams } from 'next/navigation';
import { redirect } from 'next/navigation';

/**
 * The per-partner payout drill was misframed (the platform invoices
 * merchants, doesn't pay them). New surface lives at
 * `/invoices/<partnerId>` with the same merchant + period scoping.
 *
 * Kept as a redirect so deep links from control-panel + audit cross-
 * references still resolve.
 */
export default function PerPartnerPayoutsRedirect() {
  const { partnerId } = useParams<{ partnerId: string }>();
  redirect(`/invoices/${partnerId}`);
}
