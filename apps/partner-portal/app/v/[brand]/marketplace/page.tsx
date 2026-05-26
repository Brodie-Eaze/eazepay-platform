'use client';

/**
 * /v/[brand]/marketplace — Partner-scoped lender marketplace view.
 *
 * What a med spa (or any partner) sees as the third leg of their
 * partner portal: which lenders are showing up on their consumer flow,
 * with the ability to flag a lender for pause/exclusion (subject to
 * admin approval — partners can request, not unilaterally toggle off
 * lenders the vertical config has set as default-on).
 *
 * For the demo: this is step 4 of the 8-stage walk-through, where the
 * lender sees "this is what the merchant who is sending you customers
 * sees + controls."
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  marketplaceLenders,
  marketplaces,
  isLenderEnabledForPartner,
  partnerAccessOverrides,
  tierLabel,
  type MarketplaceLenderRow,
} from '../../../../lib/marketplace-data';
import { BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';

const slugToBrand = (slug: string): BrandCode | null =>
  BRAND_ORDER.find((b) => b === slug || `${b}-pay` === slug) ?? null;

export default function PartnerMarketplacePage(): JSX.Element {
  const params = useParams<{ brand: string }>();
  const brand = params?.brand ? slugToBrand(params.brand) : null;

  // For demo purposes we use a hard-coded partnerId. In prod this comes
  // from the brand session — `partner-profile.ts` resolves it from the
  // auth context.
  const partnerId = 'demo-partner-001';

  const [requestPauseFor, setRequestPauseFor] = useState<string | null>(null);

  const visibleLenders = useMemo(() => {
    if (!brand) return [];
    return marketplaceLenders.filter((l) => l.brands.length === 0 || l.brands.includes(brand));
  }, [brand]);

  function lenderEnabled(l: MarketplaceLenderRow): boolean {
    const mp = marketplaces.find((m) => m.id === l.marketplaceId);
    if (!mp) return false;
    return isLenderEnabledForPartner(partnerId, l, mp).enabled;
  }

  const enabledLenders = visibleLenders.filter((l) => lenderEnabled(l));
  const disabledLenders = visibleLenders.filter((l) => !lenderEnabled(l));

  return (
    <div style={{ padding: 32, maxWidth: 1080, margin: '0 auto', color: '#0f172a' }}>
      <header style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#0d9488', fontWeight: 700 }}>
          MARKETPLACE · {brand?.toUpperCase() ?? 'BRAND'}
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700 }}>
          Your lender marketplace
        </h1>
        <p style={{ color: '#475569', fontSize: 14, maxWidth: 620 }}>
          Lenders showing up on your consumer flow. Click any lender to see their tier coverage and
          amount envelope. Request a pause to flag a lender for the operations team.
        </p>
      </header>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 17, color: '#0f172a' }}>
          Live in your marketplace ({enabledLenders.length})
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {enabledLenders.map((l) => (
            <LenderCard
              key={l.id}
              lender={l}
              state="enabled"
              onRequestPause={() => setRequestPauseFor(l.id)}
            />
          ))}
        </div>
      </div>

      {disabledLenders.length > 0 && (
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 17, color: '#0f172a' }}>
            Paused / unavailable ({disabledLenders.length})
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {disabledLenders.map((l) => (
              <LenderCard
                key={l.id}
                lender={l}
                state="disabled"
                pauseReason={
                  partnerAccessOverrides.find(
                    (o) => o.merchantId === partnerId && o.marketplaceLenderId === l.id,
                  )?.reason ?? null
                }
              />
            ))}
          </div>
        </div>
      )}

      {requestPauseFor && (
        <PauseRequestModal lenderId={requestPauseFor} onClose={() => setRequestPauseFor(null)} />
      )}
    </div>
  );
}

function LenderCard({
  lender,
  state,
  pauseReason,
  onRequestPause,
}: {
  lender: MarketplaceLenderRow;
  state: 'enabled' | 'disabled';
  pauseReason?: string | null;
  onRequestPause?: () => void;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 16,
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: state === 'enabled' ? '#ffffff' : '#f8fafc',
        opacity: state === 'disabled' ? 0.72 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <Link
          href={`/lender-marketplace/${lender.id}`}
          style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', textDecoration: 'none' }}
        >
          {lender.displayName}
        </Link>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            background: state === 'enabled' ? '#dcfce7' : '#fee2e2',
            color: state === 'enabled' ? '#15803d' : '#b91c1c',
          }}
        >
          {state === 'enabled' ? 'LIVE' : 'PAUSED'}
        </span>
      </div>
      <div style={{ color: '#64748b', fontSize: 11.5, marginBottom: 8 }}>
        Tiers: {lender.servesTiers.map((t) => tierLabel[t]).join(' · ')}
      </div>
      <div style={{ color: '#475569', fontSize: 11.5 }}>
        ${(lender.minAmountCents / 100).toLocaleString()} – $
        {(lender.maxAmountCents / 100).toLocaleString()} ·{' '}
        {lender.minScore ? `Min FICO ${lender.minScore}` : 'No min'}
      </div>
      {pauseReason && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: '#b91c1c' }}>
          <strong>Pause reason:</strong> {pauseReason}
        </div>
      )}
      {state === 'enabled' && onRequestPause && (
        <button
          onClick={onRequestPause}
          style={{
            marginTop: 12,
            padding: '6px 10px',
            background: 'transparent',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            color: '#475569',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Request pause
        </button>
      )}
    </div>
  );
}

function PauseRequestModal({
  lenderId,
  onClose,
}: {
  lenderId: string;
  onClose: () => void;
}): JSX.Element {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    // TODO: POST /api/v/{brand}/marketplace/pause-request { lenderId, reason }
    setTimeout(() => {
      setSubmitting(false);
      onClose();
    }, 600);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          padding: 24,
          borderRadius: 12,
          width: 480,
          maxWidth: '90vw',
        }}
      >
        <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>Request pause</h3>
        <p style={{ margin: '0 0 14px', color: '#475569', fontSize: 13 }}>
          Pausing <code>{lenderId}</code> requires ops approval. Tell us why.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. customer-reported decline rate concern, compliance flag, exclusivity carve-out…"
          style={{
            width: '100%',
            minHeight: 100,
            padding: 12,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              color: '#475569',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!reason || submitting}
            onClick={submit}
            style={{
              padding: '8px 14px',
              background: '#0d9488',
              color: 'white',
              border: 0,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !reason || submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Submitting…' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
}
