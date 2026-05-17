import { redirect } from 'next/navigation';

/**
 * Per-brand Settlements surface was removed (PR #25). Settlement /
 * funding visibility for a merchant lives on the master /settlements
 * page, which is operator-only. The per-brand portal does not need
 * its own copy because merchants don't settle through EazePay.
 *
 * Old bookmarks redirect to the per-brand Applications page where
 * the merchant can see which of their applications have funded.
 */
export default function BrandSettlementsRedirect({ params }: { params: { brand: string } }) {
  redirect(`/v/${params.brand}/applications`);
}
