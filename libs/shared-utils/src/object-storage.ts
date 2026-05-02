/**
 * ObjectStorage port — abstraction over S3 / Azure Blob / GCS / local FS.
 *
 * Design rules for callers:
 *  - Bytes go through this interface; never write files via fs.* outside
 *    the LocalFs adapter.
 *  - put() returns a stable key; the caller persists the key on the
 *    Document row plus the SHA-256 it computed alongside.
 *  - presignedReadUrl() is short-lived (TTL ≤ 15 minutes for sensitive
 *    documents); never log the URL.
 *  - delete() is reserved for retention sweeps. Callers should prefer
 *    Document.status='destroyed' + an audit row over actual deletion.
 */
export interface ObjectStoragePutInput {
  /** Logical bucket id within the configured backend. */
  bucket: string;
  /** Stable, app-controlled key (e.g. `documents/<id>.pdf`). */
  key: string;
  body: Buffer;
  contentType: string;
  /** Server-side metadata (round-tripped where the backend supports it). */
  metadata?: Record<string, string>;
}

export interface ObjectStoragePutResult {
  key: string;
  /** Backend identifier ('s3', 'local-fs') — persisted on Document.storage. */
  storage: string;
  sizeBytes: number;
}

export interface ObjectStorage {
  readonly storage: string;
  put(input: ObjectStoragePutInput): Promise<ObjectStoragePutResult>;
  get(input: { bucket: string; key: string }): Promise<Buffer>;
  /** Returns a short-lived URL for direct client download. */
  presignedReadUrl(input: {
    bucket: string;
    key: string;
    ttlSeconds: number;
    /** Optional content-disposition override (filename for download). */
    filename?: string;
  }): Promise<string>;
  /** Hard delete — use sparingly; prefer logical Document.status='destroyed'. */
  delete(input: { bucket: string; key: string }): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
