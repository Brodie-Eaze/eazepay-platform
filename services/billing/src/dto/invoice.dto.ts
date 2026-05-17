import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PeriodIdSchema = z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM');

export const GenerateBatchSchema = z.object({ periodId: PeriodIdSchema }).strict();
export class GenerateBatchDto extends createZodDto(GenerateBatchSchema) {}

export const ListInvoicesQuerySchema = z
  .object({
    periodId: PeriodIdSchema.optional(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'voided']).optional(),
    merchantId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();
export class ListInvoicesQueryDto extends createZodDto(ListInvoicesQuerySchema) {}

export const SetStatusSchema = z
  .object({ status: z.enum(['draft', 'sent', 'paid', 'overdue']) })
  .strict();
export class SetStatusDto extends createZodDto(SetStatusSchema) {}

export const SetFeePctSchema = z
  .object({
    /** Percent value (e.g. 3.5 = 3.5%). Server converts to basis points. */
    feePct: z.number().min(0).max(50),
  })
  .strict();
export class SetFeePctDto extends createZodDto(SetFeePctSchema) {}

export const SetAmountSchema = z
  .object({ amountCents: z.number().int().min(0).max(1_000_000_000_000) })
  .strict();
export class SetAmountDto extends createZodDto(SetAmountSchema) {}

export const SetDueDateSchema = z
  .object({ dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
  .strict();
export class SetDueDateDto extends createZodDto(SetDueDateSchema) {}

export const VoidInvoiceSchema = z.object({ reason: z.string().min(1).max(500) }).strict();
export class VoidInvoiceDto extends createZodDto(VoidInvoiceSchema) {}

export const RecordPaymentSchema = z
  .object({
    amountCents: z.number().int().min(1).max(1_000_000_000_000),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    method: z.enum(['ach', 'wire', 'card', 'check', 'other']),
    reference: z.string().max(200).optional(),
    note: z.string().max(2000).optional(),
    markPaid: z.boolean().optional(),
  })
  .strict();
export class RecordPaymentDto extends createZodDto(RecordPaymentSchema) {}

export const ComposeSendSchema = z
  .object({
    /** Optional: ensures the recipient email returned to caller is fresh. */
    invoiceNo: z.string().min(1).max(120),
  })
  .strict();
export class ComposeSendDto extends createZodDto(ComposeSendSchema) {}

export const ConfirmDecisionSchema = z
  .object({
    decision: z.enum(['confirm', 'dispute']),
    reason: z.string().max(2000).optional(),
  })
  .strict();
export class ConfirmDecisionDto extends createZodDto(ConfirmDecisionSchema) {}
