export * from './audit.module.js';
export * from './audit-drain.service.js';
export * from './ports/audit-sink.port.js';
export * from './adapters/local-fs-audit-sink.adapter.js';
// SEC-040 — typed payload contract for audit writes; runtime validator
// + compile-time `AuditWritePayload<T>` mapped type.
export * from './audit-payload.js';
