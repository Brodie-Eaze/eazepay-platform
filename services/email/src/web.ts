/**
 * Framework-free entry point for `@eazepay/service-email`.
 *
 * The default barrel (`./index.ts`) re-exports NestJS modules + the
 * Prisma + Resend adapters; importing it from a Next.js / pure-Node
 * surface drags the whole `@nestjs/*` graph into the webpack bundle
 * and the build dies with "Cannot resolve '@nestjs/common'" unless
 * the consumer also installs Nest.
 *
 * This entry point exposes ONLY the parts a non-Nest consumer needs:
 *   - brand-context resolver (vertical → from-address / accent / logo)
 *   - pure template renderers (welcome, team-invite, invoice, password-reset)
 *
 * Consumers (partner-portal BFF routes, scripts, CLIs) should import
 * from `@eazepay/service-email/web`, not the default entry.
 */
export * from './brand-context.js';
export * from './templates/welcome.js';
export * from './templates/password-reset.js';
export * from './templates/team-invite.js';
export * from './templates/invoice-issued.js';
