/**
 * POST /api/billing/stripe/create-setup-session
 *
 * Creates a Stripe Checkout session for the $10,000 platform setup
 * fee on the MedPay / TradePay / CoachPay /<brand>/checkout pages.
 *
 * Today this is a placeholder: it returns { stub: true, redirect }
 * so the front-end can bypass to /<brand>/onboarding while Stripe
 * is not yet wired. To activate live Stripe Checkout:
 *
 *   1. `pnpm add stripe` in apps/partner-portal
 *   2. set `STRIPE_SECRET_KEY` in the Railway service environment
 *      (and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` if we ever swap
 *      this for inline Elements instead of a hosted Checkout)
 *   3. uncomment the "live mode" branch below and delete the stub
 *      branch above it
 *   4. set the price ID on the Stripe dashboard or use price_data
 *      inline as shown — both work
 *
 * The front-end posts:
 *   { brand: 'medpay'|'tradepay'|'coachpay', businessName, billingEmail }
 *
 * The endpoint returns either:
 *   { url }                       — redirect target on Stripe.com
 *   { stub, message, redirect }   — bypass target inside the app
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type RequestBody = {
  brand: 'medpay' | 'tradepay' | 'coachpay';
  businessName?: string;
  billingEmail?: string;
};

const SETUP_FEE_USD = 10_000;

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { brand, businessName, billingEmail } = body;
  if (!brand || !['medpay', 'tradepay', 'coachpay'].includes(brand)) {
    return NextResponse.json({ error: 'invalid_brand' }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const liveMode = Boolean(stripeKey && stripeKey.startsWith('sk_'));

  if (!liveMode) {
    /* ----- STUB MODE (no STRIPE_SECRET_KEY in env) -----
     * Return a structured success the front-end recognises as a
     * bypass. We still log the intent so ops can see who would have
     * been charged once the keys go in. */
    // eslint-disable-next-line no-console
    console.info('[stripe-stub] setup-session', { brand, businessName, billingEmail });
    return NextResponse.json({
      stub: true,
      message:
        'Stripe checkout placeholder — STRIPE_SECRET_KEY not configured. Continuing to onboarding without charging.',
      redirect: `/${brand}/onboarding`,
      summary: {
        brand,
        amountUsd: SETUP_FEE_USD,
        businessName: businessName ?? null,
        billingEmail: billingEmail ?? null,
      },
    });
  }

  /* ----- LIVE MODE (STRIPE_SECRET_KEY set) -----
   * Uncomment after `pnpm add stripe` lands in the partner-portal
   * package.json. Until then this block is a noop reachable only
   * when the env var is set, which won't happen on a fresh deploy.
   *
   *   const { default: Stripe } = await import('stripe');
   *   const stripe = new Stripe(stripeKey!, { apiVersion: '2024-12-18.acacia' });
   *   const origin = req.headers.get('origin') ?? '';
   *   const session = await stripe.checkout.sessions.create({
   *     mode: 'payment',
   *     line_items: [{
   *       price_data: {
   *         currency: 'usd',
   *         product_data: { name: `${brand.toUpperCase()} platform setup fee` },
   *         unit_amount: SETUP_FEE_USD * 100, // dollars → cents
   *       },
   *       quantity: 1,
   *     }],
   *     customer_email: billingEmail || undefined,
   *     success_url: `${origin}/${brand}/onboarding?stripe=success&session={CHECKOUT_SESSION_ID}`,
   *     cancel_url: `${origin}/${brand}/checkout?stripe=cancelled`,
   *     metadata: { brand, businessName: businessName ?? '' },
   *   });
   *   return NextResponse.json({ url: session.url });
   */

  return NextResponse.json({ error: 'live_mode_not_implemented' }, { status: 501 });
}
