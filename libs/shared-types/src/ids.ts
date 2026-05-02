import { z } from 'zod';

declare const idBrand: unique symbol;

export type BrandedId<TBrand extends string> = string & {
  readonly [idBrand]: TBrand;
};

const uuid = z.string().uuid();

const brandedIdSchema = <TBrand extends string>(_brand: TBrand) =>
  uuid.transform((v) => v as BrandedId<TBrand>);

export type UserId = BrandedId<'User'>;
export type ConsumerProfileId = BrandedId<'ConsumerProfile'>;
export type SessionId = BrandedId<'Session'>;
export type MerchantId = BrandedId<'Merchant'>;
export type MerchantUserId = BrandedId<'MerchantUser'>;
export type BeneficialOwnerId = BrandedId<'BeneficialOwner'>;
export type ApplicationId = BrandedId<'Application'>;
export type OfferId = BrandedId<'Offer'>;
export type LoanId = BrandedId<'Loan'>;
export type LenderId = BrandedId<'Lender'>;
export type LenderProductId = BrandedId<'LenderProduct'>;
export type LenderRouteId = BrandedId<'LenderRoute'>;
export type DocumentId = BrandedId<'Document'>;
export type ConsentId = BrandedId<'Consent'>;
export type ContractId = BrandedId<'Contract'>;
export type PaymentMethodId = BrandedId<'PaymentMethod'>;
export type TransactionId = BrandedId<'Transaction'>;
export type SettlementId = BrandedId<'Settlement'>;
export type RepaymentId = BrandedId<'Repayment'>;
export type WebhookEndpointId = BrandedId<'WebhookEndpoint'>;
export type AuditLogId = BrandedId<'AuditLog'>;
export type RiskFlagId = BrandedId<'RiskFlag'>;
export type SupportTicketId = BrandedId<'SupportTicket'>;
export type NotificationId = BrandedId<'Notification'>;
export type ApiKeyId = BrandedId<'ApiKey'>;
export type IntegrationId = BrandedId<'Integration'>;
export type ComplianceReviewId = BrandedId<'ComplianceReview'>;

export const UserIdSchema = brandedIdSchema('User');
export const ConsumerProfileIdSchema = brandedIdSchema('ConsumerProfile');
export const SessionIdSchema = brandedIdSchema('Session');
export const MerchantIdSchema = brandedIdSchema('Merchant');
export const MerchantUserIdSchema = brandedIdSchema('MerchantUser');
export const BeneficialOwnerIdSchema = brandedIdSchema('BeneficialOwner');
export const ApplicationIdSchema = brandedIdSchema('Application');
export const OfferIdSchema = brandedIdSchema('Offer');
export const LoanIdSchema = brandedIdSchema('Loan');
export const LenderIdSchema = brandedIdSchema('Lender');
export const LenderProductIdSchema = brandedIdSchema('LenderProduct');
export const LenderRouteIdSchema = brandedIdSchema('LenderRoute');
export const DocumentIdSchema = brandedIdSchema('Document');
export const ConsentIdSchema = brandedIdSchema('Consent');
export const ContractIdSchema = brandedIdSchema('Contract');
export const PaymentMethodIdSchema = brandedIdSchema('PaymentMethod');
export const TransactionIdSchema = brandedIdSchema('Transaction');
export const SettlementIdSchema = brandedIdSchema('Settlement');
export const RepaymentIdSchema = brandedIdSchema('Repayment');
export const WebhookEndpointIdSchema = brandedIdSchema('WebhookEndpoint');
export const AuditLogIdSchema = brandedIdSchema('AuditLog');
export const RiskFlagIdSchema = brandedIdSchema('RiskFlag');
export const SupportTicketIdSchema = brandedIdSchema('SupportTicket');
export const NotificationIdSchema = brandedIdSchema('Notification');
export const ApiKeyIdSchema = brandedIdSchema('ApiKey');
export const IntegrationIdSchema = brandedIdSchema('Integration');
export const ComplianceReviewIdSchema = brandedIdSchema('ComplianceReview');
