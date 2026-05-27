import {
  DecryptCommand,
  DescribeKeyCommand,
  GenerateDataKeyCommand,
  GetKeyRotationStatusCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { Logger } from '@nestjs/common';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AwsKmsKeyManager,
  DEFAULT_KMS_ENCRYPTION_CONTEXT,
  KmsOperationError,
} from '../src/adapters/aws-kms-key-manager.adapter.js';

const KEY_ARN = 'arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555';
const KEY_ALIAS = 'alias/eazepay-kek-test';

// Test helpers for the AwsKmsKeyManager. We never spin up a real KMS
// client — `aws-sdk-client-mock` intercepts at the middleware layer so
// the adapter exercises its full GenerateDataKey/Decrypt/DescribeKey
// code path against fixture responses.

const kmsMock = mockClient(KMSClient);

const makeAdapter = (
  opts: { keyId?: string; encryptionContext?: Record<string, string> } = {},
): AwsKmsKeyManager =>
  new AwsKmsKeyManager({
    keyId: opts.keyId ?? KEY_ARN,
    client: new KMSClient({ region: 'us-east-1' }),
    ...(opts.encryptionContext ? { encryptionContext: opts.encryptionContext } : {}),
  });

beforeEach(() => {
  kmsMock.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AwsKmsKeyManager — construction guards', () => {
  it('throws when keyId is the empty string', () => {
    expect(
      () =>
        new AwsKmsKeyManager({
          keyId: '',
          client: new KMSClient({ region: 'us-east-1' }),
        }),
    ).toThrow(/keyId/);
  });

  it('throws when keyId is whitespace', () => {
    expect(
      () =>
        new AwsKmsKeyManager({
          keyId: '   ',
          client: new KMSClient({ region: 'us-east-1' }),
        }),
    ).toThrow(/keyId/);
  });

  it('module factory throws when KMS_KEK_KEY_ID env is unset', async () => {
    // Mirror the user.module.ts factory branch — this is the boot guard
    // PR #170's audit asked for. The adapter itself never reads env, so
    // we re-run the module's resolution logic here to lock the contract.
    const original = process.env.KMS_KEK_KEY_ID;
    delete process.env.KMS_KEK_KEY_ID;
    try {
      const { UserModule } = await import('../src/user.module.js');
      const moduleDef = UserModule.forRoot({
        prismaToken: Symbol('test-prisma'),
        keyManager: 'aws-kms',
        kycProvider: 'mock',
        isDevelopment: true,
      });
      const keyManagerProvider = (moduleDef.providers ?? []).find(
        (p): p is { provide: symbol; useFactory: () => unknown } =>
          typeof p === 'object' &&
          'useFactory' in p &&
          p.provide.toString() === 'Symbol(KEY_MANAGER)',
      );
      expect(keyManagerProvider).toBeDefined();
      expect(() => keyManagerProvider!.useFactory()).toThrow(/KMS_KEK_KEY_ID/);
    } finally {
      if (original !== undefined) process.env.KMS_KEK_KEY_ID = original;
    }
  });
});

describe('AwsKmsKeyManager — generateDataKey', () => {
  it('returns plaintext + ciphertext + resolved kekId when KMS responds OK', async () => {
    const plaintext = Buffer.alloc(32, 0xab);
    const ciphertext = Buffer.from('encrypted-dek-blob');
    kmsMock.on(GenerateDataKeyCommand).resolves({
      Plaintext: plaintext,
      CiphertextBlob: ciphertext,
      KeyId: KEY_ARN,
    });

    const adapter = makeAdapter({ keyId: KEY_ALIAS });
    const dk = await adapter.generateDataKey();

    expect(dk.plaintext.equals(plaintext)).toBe(true);
    expect(dk.ciphertext.equals(ciphertext)).toBe(true);
    // KMS resolves alias → ARN; we persist what KMS gave us.
    expect(dk.kekId).toBe(KEY_ARN);

    const sent = kmsMock.commandCalls(GenerateDataKeyCommand);
    expect(sent).toHaveLength(1);
    expect(sent[0].args[0].input.KeyId).toBe(KEY_ALIAS);
    expect(sent[0].args[0].input.KeySpec).toBe('AES_256');
    expect(sent[0].args[0].input.EncryptionContext).toEqual(DEFAULT_KMS_ENCRYPTION_CONTEXT);
  });

  it('writes a structured kms.generate_data_key.ok log on success', async () => {
    kmsMock.on(GenerateDataKeyCommand).resolves({
      Plaintext: Buffer.alloc(32, 0xab),
      CiphertextBlob: Buffer.from('blob'),
      KeyId: KEY_ARN,
    });
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    const adapter = makeAdapter();
    await adapter.generateDataKey();

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0][0] as { event: string; keyId: string; latencyMs: number };
    expect(payload.event).toBe('kms.generate_data_key.ok');
    expect(payload.keyId).toBe(KEY_ARN);
    expect(typeof payload.latencyMs).toBe('number');
    expect(payload.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('wraps a MalformedResponse when KMS returns no Plaintext', async () => {
    kmsMock.on(GenerateDataKeyCommand).resolves({
      // missing Plaintext + CiphertextBlob
      KeyId: KEY_ARN,
    });

    const adapter = makeAdapter();
    await expect(adapter.generateDataKey()).rejects.toBeInstanceOf(KmsOperationError);
    await expect(adapter.generateDataKey()).rejects.toMatchObject({
      operation: 'generate_data_key',
      sdkErrorName: 'MalformedResponse',
    });
  });
});

describe('AwsKmsKeyManager — decryptDataKey', () => {
  it('returns plaintext when KMS responds OK with matching encryption context', async () => {
    const plaintext = Buffer.alloc(32, 0xcd);
    kmsMock.on(DecryptCommand).resolves({
      Plaintext: plaintext,
      KeyId: KEY_ARN,
    });

    const adapter = makeAdapter();
    const out = await adapter.decryptDataKey({
      ciphertext: Buffer.from('encrypted-dek-blob'),
      kekId: KEY_ARN,
    });

    expect(out.equals(plaintext)).toBe(true);
    const sent = kmsMock.commandCalls(DecryptCommand);
    expect(sent).toHaveLength(1);
    expect(sent[0].args[0].input.KeyId).toBe(KEY_ARN);
    expect(sent[0].args[0].input.EncryptionContext).toEqual(DEFAULT_KMS_ENCRYPTION_CONTEXT);
  });

  it('throws KmsOperationError when KMS returns InvalidCiphertextException', async () => {
    const sdkErr = Object.assign(
      new Error('Ciphertext refers to a customer master key that does not exist.'),
      {
        name: 'InvalidCiphertextException',
      },
    );
    kmsMock.on(DecryptCommand).rejects(sdkErr);

    const adapter = makeAdapter();
    await expect(
      adapter.decryptDataKey({ ciphertext: Buffer.from('bad'), kekId: KEY_ARN }),
    ).rejects.toMatchObject({
      name: 'KmsOperationError',
      operation: 'decrypt',
      sdkErrorName: 'InvalidCiphertextException',
      keyId: KEY_ARN,
    });
  });

  it('rejects when encryption context mismatch (security invariant)', async () => {
    // Simulate KMS's real behaviour: ciphertext was sealed with one
    // context; decrypt is called with a different context — KMS rejects
    // with InvalidCiphertextException. The test asserts the adapter
    // wraps and propagates that, not that it short-circuits before the
    // call (because KMS is the source of truth on context binding).
    const sealedWithDefault = makeAdapter();
    const decryptedWithOverride = makeAdapter({
      encryptionContext: { tenant: 'other-tenant', purpose: 'pii_envelope' },
    });

    // Seal: returns ciphertext fixture
    kmsMock.on(GenerateDataKeyCommand).resolves({
      Plaintext: Buffer.alloc(32, 0x11),
      CiphertextBlob: Buffer.from('dek-blob'),
      KeyId: KEY_ARN,
    });
    const dk = await sealedWithDefault.generateDataKey();

    // Decrypt with a mismatching context — KMS rejects.
    kmsMock.on(DecryptCommand).callsFake((input) => {
      const ctx = input.EncryptionContext as Record<string, string> | undefined;
      if (ctx?.tenant !== 'eazepay') {
        return Promise.reject(
          Object.assign(new Error('EncryptionContext mismatch'), {
            name: 'InvalidCiphertextException',
          }),
        );
      }
      return Promise.resolve({ Plaintext: Buffer.alloc(32, 0x11), KeyId: KEY_ARN });
    });

    await expect(
      decryptedWithOverride.decryptDataKey({ ciphertext: dk.ciphertext, kekId: dk.kekId }),
    ).rejects.toMatchObject({
      name: 'KmsOperationError',
      sdkErrorName: 'InvalidCiphertextException',
    });

    // Sanity: same adapter that sealed it CAN decrypt it.
    const ok = await sealedWithDefault.decryptDataKey({
      ciphertext: dk.ciphertext,
      kekId: dk.kekId,
    });
    expect(ok.length).toBe(32);
  });

  it('writes a structured kms.decrypt.err log when KMS rejects', async () => {
    kmsMock
      .on(DecryptCommand)
      .rejects(Object.assign(new Error('boom'), { name: 'AccessDeniedException' }));
    const spy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const adapter = makeAdapter();
    await expect(
      adapter.decryptDataKey({ ciphertext: Buffer.from('x'), kekId: KEY_ARN }),
    ).rejects.toBeInstanceOf(KmsOperationError);

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0][0] as {
      event: string;
      sdkErrorName: string;
      keyId: string;
    };
    expect(payload.event).toBe('kms.decrypt.err');
    expect(payload.sdkErrorName).toBe('AccessDeniedException');
    expect(payload.keyId).toBe(KEY_ARN);
  });
});

describe('AwsKmsKeyManager — describeKey', () => {
  it('returns parsed metadata + rotation status', async () => {
    kmsMock.on(DescribeKeyCommand).resolves({
      KeyMetadata: {
        KeyId: KEY_ARN,
        KeyState: 'Enabled',
        KeySpec: 'SYMMETRIC_DEFAULT',
      },
    });
    kmsMock.on(GetKeyRotationStatusCommand).resolves({
      KeyRotationEnabled: true,
    });

    const adapter = makeAdapter();
    const meta = await adapter.describeKey();

    expect(meta).toEqual({
      keyId: KEY_ARN,
      keyState: 'Enabled',
      keySpec: 'SYMMETRIC_DEFAULT',
      rotationEnabled: true,
    });
  });

  it('reports rotationEnabled=false when GetKeyRotationStatus AccessDenied (AWS-managed key)', async () => {
    kmsMock.on(DescribeKeyCommand).resolves({
      KeyMetadata: {
        KeyId: 'alias/aws/s3',
        KeyState: 'Enabled',
        KeySpec: 'SYMMETRIC_DEFAULT',
      },
    });
    kmsMock
      .on(GetKeyRotationStatusCommand)
      .rejects(
        Object.assign(new Error('forbidden on aws-managed'), { name: 'AccessDeniedException' }),
      );

    const meta = await makeAdapter().describeKey('alias/aws/s3');
    expect(meta.rotationEnabled).toBe(false);
  });

  it('wraps an SDK error as KmsOperationError', async () => {
    kmsMock
      .on(DescribeKeyCommand)
      .rejects(Object.assign(new Error('not found'), { name: 'NotFoundException' }));

    await expect(makeAdapter().describeKey()).rejects.toMatchObject({
      name: 'KmsOperationError',
      operation: 'describe_key',
      sdkErrorName: 'NotFoundException',
    });
  });
});

describe('AwsKmsKeyManager — audit logging', () => {
  it('emits one log line per successful operation', async () => {
    kmsMock.on(GenerateDataKeyCommand).resolves({
      Plaintext: Buffer.alloc(32, 0x01),
      CiphertextBlob: Buffer.from('blob'),
      KeyId: KEY_ARN,
    });
    kmsMock.on(DecryptCommand).resolves({
      Plaintext: Buffer.alloc(32, 0x02),
      KeyId: KEY_ARN,
    });
    kmsMock.on(DescribeKeyCommand).resolves({
      KeyMetadata: { KeyId: KEY_ARN, KeyState: 'Enabled', KeySpec: 'SYMMETRIC_DEFAULT' },
    });
    kmsMock.on(GetKeyRotationStatusCommand).resolves({ KeyRotationEnabled: true });
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    const adapter = makeAdapter();
    await adapter.generateDataKey();
    await adapter.decryptDataKey({ ciphertext: Buffer.from('x'), kekId: KEY_ARN });
    await adapter.describeKey();

    const events = spy.mock.calls.map((c) => (c[0] as { event: string }).event);
    expect(events).toEqual(['kms.generate_data_key.ok', 'kms.decrypt.ok', 'kms.describe_key.ok']);
  });
});
