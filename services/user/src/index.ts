export * from './user.module.js';
export * from './user.service.js';
export * from './user.controller.js';
export * from './pii.types.js';
export * from './internal/pii-vault.service.js';
export * from './ports/key-manager.port.js';
export * from './ports/kyc-provider.port.js';
export * from './adapters/aws-kms-key-manager.adapter.js';
// PRIV-014 — surface the dev/local KEK manager so other packages' tests
// (e.g. service-admin erasure tests) can build a real vault to prove
// crypto-shred irreversibility without standing up KMS.
export * from './adapters/local-key-manager.adapter.js';
export * from './dto/update-profile.dto.js';
export * from './dto/start-kyc.dto.js';
