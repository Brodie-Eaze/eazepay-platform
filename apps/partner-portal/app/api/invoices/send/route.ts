/**
 * Master Billing — invoice send (branded email).
 *
 *   POST /api/invoices/send
 *
 * Fires when the master operator clicks "Send" in the Monthly Billing
 * SendDialog. Dispatches the branded invoice-issued email through the
 * partner-portal's server-email helper, which picks the right
 * vertical's from-address (noreply@medpay.eazepay.com, etc.) and
 * renders the shared template.
 *
 * Pre-fix the SendDialog opened a `mailto:` link — useful for dev,
 * but not deliverable in production. This route is the Phase B dispatch
 * the dialog's "(Resend wired)" comment referenced.
 *
 * Operator-tier session required (this is the master billing surface).
 * Brand-scoped demo sessions are explicitly denied — partner merchants
 * never trigger their own invoice email.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { enforceCsrf } from '../../../../lib/csrf.js';
import { getSessionContext } from '../../../../lib/session';
import { sendInvoiceIssuedEmail } from '../../../../lib/server-email';

const BodySchema = z
  .object({
    /** Brand the invoice belongs to. Determines the from-address. */
    brand: z.enum(['medpay', 'tradepay', 'coachpay']),
    /** Where to send the invoice email. */
    to: z.string().trim().email(),
    invoiceNo: z.string().trim().min(1).max(120),
    merchantBusinessName: z.string().trim().min(1).max(200),
    recipientName: z.string().trim().min(1).max(120).default('there'),
    periodLabel: z.string().trim().min(1).max(60),
    grossFundedCents: z.number().int().nonnegative(),
    feePct: z.number().nonnegative().max(1),
    amountDueCents: z.number().int().nonnegative(),
    dueDate: z.string().trim().min(1).max(40),
    confirmUrl: z.string().url(),
    payUrl: z.string().url().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

  const session = await getSessionContext(req);
  if (session.mode === 'none') {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'not_signed_in',
      },
      { status: 401 },
    );
  }

  // Master-billing surface — brand-scoped sessions can't fire other
  // partners' invoice emails. Operator-tier (master/all/admin/operator)
  // or real-session: allowed.
  const isOperator = (session.mode === 'demo' && session.isOperator) || session.mode === 'real';
  if (!isOperator) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'operator_required',
        detail: 'Invoice send is a master-operator action.',
      },
      { status: 403 },
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_invoice_send_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await sendInvoiceIssuedEmail({
      brand: parsed.data.brand,
      to: parsed.data.to,
      idempotencyKey: `invoice-${parsed.data.invoiceNo}`,
      vars: {
        recipientName: parsed.data.recipientName,
        merchantBusinessName: parsed.data.merchantBusinessName,
        invoiceNo: parsed.data.invoiceNo,
        periodLabel: parsed.data.periodLabel,
        grossFundedCents: parsed.data.grossFundedCents,
        feePct: parsed.data.feePct,
        amountDueCents: parsed.data.amountDueCents,
        dueDate: parsed.data.dueDate,
        confirmUrl: parsed.data.confirmUrl,
        ...(parsed.data.payUrl ? { payUrl: parsed.data.payUrl } : {}),
      },
    });
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      sentAt: result.sentAt.toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'invoice.send_failed',
        invoiceNo: parsed.data.invoiceNo,
        msg: (err as Error).message,
      }),
    );
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Email send failed',
        status: 502,
        code: 'email_send_failed',
        detail: (err as Error).message,
      },
      { status: 502 },
    );
  }
}
