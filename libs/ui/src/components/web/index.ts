// Backwards-compatible re-export. The canonical web entrypoint moved
// to `libs/ui/src/web/`. Existing apps that still import from
// `@eazepay/ui/web` (which historically pointed at this file) keep
// working without code changes.
export * from '../../web/index.js';
