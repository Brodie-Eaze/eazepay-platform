import { redirect } from 'next/navigation';

/**
 * Per-brand Transactions surface was removed (PR #25). Per-brand
 * merchants do not process cards through EazePay — MiCamp handles
 * their gateway on a separate platform — so this surface implied
 * scope we don't own. Old bookmarks redirect to the per-brand
 * Applications page, which is now the merchant's primary workspace.
 */
export default function BrandTransactionsRedirect({ params }: { params: { brand: string } }) {
  redirect(`/v/${params.brand}/applications`);
}
