/**
 * Index page for the 5 MedPay ad variants. Each link opens the
 * variant at 1080×1080 for clean screenshot export.
 */
import Link from 'next/link';

const VARIANTS = [
  { n: '1', name: 'CFO Math', sub: '$1.4M lost / yr · recovered case mock' },
  { n: '2', name: 'Walked Out', sub: 'Speech-bubble scenario · emotional' },
  { n: '3', name: 'Cherry vs MedPay', sub: 'Side-by-side competitive switch' },
  { n: '4', name: '10 Seconds at the Chair', sub: 'Tablet · operational speed' },
  { n: '5', name: '38% → 70%', sub: 'Bar chart · outcome / results' },
];

export default function MedPayAdsGallery(): JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050a14',
        color: '#fff',
        padding: '64px 32px',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
        MedPay · Ad variants
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.62)', marginBottom: 32 }}>
        5 ad mockups at 1080×1080. Each link opens the canvas at native size for screenshot export.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {VARIANTS.map((v) => (
          <Link
            key={v.n}
            href={`/ads/medpay/${v.n}`}
            style={{
              display: 'block',
              padding: 24,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(34,184,160,0.28)',
              borderRadius: 16,
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                fontFamily: 'SF Mono, Menlo, monospace',
                fontSize: 11,
                letterSpacing: '0.20em',
                color: '#22B8A0',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Variant {v.n}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.012em' }}>{v.name}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.62)' }}>
              {v.sub}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
