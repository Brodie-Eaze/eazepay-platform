import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHmac, randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import type {
  ObjectStorage,
  ObjectStoragePutInput,
  ObjectStoragePutResult,
} from './object-storage';
import { NotFound } from './problem';

/**
 * DEV ONLY filesystem-backed ObjectStorage. Stores objects under a root
 * dir keyed by `<bucket>/<key>`. presignedReadUrl returns a short-lived
 * URL signed with HMAC-SHA256 against a process-local secret — the
 * dev-server route /dev-storage/:bucket/:key?sig=&exp=&fn= validates
 * the signature before serving the bytes.
 *
 * Production swap is an S3-backed adapter that puts via PutObjectCommand
 * (KMS server-side encryption) and signs reads via GetObjectCommand
 * presigner. The interface is identical so callers don't change.
 */
export class LocalFsObjectStorage implements ObjectStorage {
  readonly storage = 'local-fs';

  constructor(
    private readonly rootDir: string,
    /** Process-local HMAC secret for presigned-URL signatures. */
    private readonly signingSecret: string = randomBytes(32).toString('hex'),
    /** Public base URL the dev server uses to serve signed reads. */
    private readonly publicBaseUrl: string = 'http://localhost:3000/dev-storage',
  ) {}

  async put(input: ObjectStoragePutInput): Promise<ObjectStoragePutResult> {
    const path = this.path(input.bucket, input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);
    return {
      key: input.key,
      storage: this.storage,
      sizeBytes: input.body.length,
    };
  }

  async get(input: { bucket: string; key: string }): Promise<Buffer> {
    const path = this.path(input.bucket, input.key);
    try {
      return await readFile(path);
    } catch {
      throw NotFound({ code: 'object_not_found' });
    }
  }

  async presignedReadUrl(input: {
    bucket: string;
    key: string;
    ttlSeconds: number;
    filename?: string;
  }): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + input.ttlSeconds;
    const sig = this.sign(input.bucket, input.key, exp);
    const params = new URLSearchParams({ sig, exp: String(exp) });
    if (input.filename) params.set('fn', input.filename);
    const encodedKey = input.key.split('/').map(encodeURIComponent).join('/');
    return `${this.publicBaseUrl}/${encodeURIComponent(input.bucket)}/${encodedKey}?${params.toString()}`;
  }

  async delete(input: { bucket: string; key: string }): Promise<void> {
    const path = this.path(input.bucket, input.key);
    try {
      await rm(path);
    } catch {
      /* swallow not-found */
    }
  }

  /** Public so a dev-server controller can verify the signature. */
  verifySignature(bucket: string, key: string, exp: number, sig: string): boolean {
    if (Number.isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = this.sign(bucket, key, exp);
    // Constant-time compare on equal-length hex strings.
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    }
    return diff === 0;
  }

  /** Returns absolute path for a (bucket, key) pair, refusing path traversal. */
  pathForRead(bucket: string, key: string): string {
    return this.path(bucket, key);
  }

  /** Probe whether a key exists (used by dev-server controller). */
  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await stat(this.path(bucket, key));
      return true;
    } catch {
      return false;
    }
  }

  private path(bucket: string, key: string): string {
    const safeBucket = bucket.replace(/[^A-Za-z0-9._-]/g, '_');
    const safeKey = key.replace(/\\/g, '/');
    if (safeKey.includes('..')) {
      throw new Error('local-fs: path traversal attempted');
    }
    const abs = resolve(this.rootDir, safeBucket, safeKey);
    if (!abs.startsWith(resolve(this.rootDir))) {
      throw new Error('local-fs: resolved path escapes root');
    }
    return abs;
  }

  private sign(bucket: string, key: string, exp: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${bucket}\n${key}\n${exp}`)
      .digest('hex');
  }
}
