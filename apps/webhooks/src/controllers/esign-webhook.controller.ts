/**
 * Re-uses the same controller class shipped from apps/api. Lives here
 * as a thin re-export so the standalone webhooks app has matching
 * behavior. When more inbound webhook handlers (lender / KYC /
 * payment provider) land, they get their own controller files in
 * this directory.
 */
export { ESignWebhookController } from '../../../api/src/app/esign-webhook.controller.js';
