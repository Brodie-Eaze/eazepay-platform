import { createHash } from 'node:crypto';

export const sha256Hex = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex');

// Stable hash of a JSON-serializable value (sorted keys) — useful for
// idempotency request fingerprints.
export const stableJsonSha256 = (value: unknown): string => {
  const sortKeys = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, sortKeys(val)]),
    );
  };
  return sha256Hex(JSON.stringify(sortKeys(value)));
};
