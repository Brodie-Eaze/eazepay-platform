import { z } from 'zod';

export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

export const EmailSchema = z.string().email().max(254).toLowerCase();
export type Email = z.infer<typeof EmailSchema>;

// E.164 international phone format. NOT a strict validator — leave to a phone library at the edge.
export const PhoneE164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/);
export type PhoneE164 = z.infer<typeof PhoneE164Schema>;

export const UsStateSchema = z.enum([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);
export type UsState = z.infer<typeof UsStateSchema>;

// US-only Phase 1: ZIP code (5 or ZIP+4).
export const UsZipSchema = z.string().regex(/^\d{5}(-\d{4})?$/);
export type UsZip = z.infer<typeof UsZipSchema>;

export const PaginationCursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type PaginationCursor = z.infer<typeof PaginationCursorSchema>;
