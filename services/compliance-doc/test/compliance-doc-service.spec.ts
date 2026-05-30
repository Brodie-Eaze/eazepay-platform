import { describe, expect, it, vi } from 'vitest';
import { ComplianceDocService } from '../src/compliance-doc.service.js';

/**
 * Characterisation tests for ComplianceDocService. The legacy code is
 * the oracle: tests assert what generateAdverseActionNoticeForApplication
 * *actually does today*, including:
 *   - idempotency on (Application, adverse_action_notice, status=active)
 *   - the supersede flow contract
 *   - the bureau key-factors flow (§615(a) FCRA)
 *   - the 25-month retention stamp
 *   - the AAN delivery notification fan-out via NotifyPort
 *
 * Behaviours called for in the spec but NOT implemented today
 * (aan_due_by, ≥4-reason hard cap) are recorded as `it.todo` so the
 * rewrite has a target.
 */

type DocRow = {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  status: string;
  sha256: string;
  sizeBytes: number;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

function makeFakePrisma(seed: { application: Record<string, unknown> | null; existingDoc?: DocRow | null }) {
  const docs: DocRow[] = seed.existingDoc ? [seed.existingDoc] : [];
  const audits: Array<Record<string, unknown>> = [];

  const fake = {
    docs,
    audits,
    document: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return (
          docs.find(
            (d) =>
              d.ownerType === where['ownerType'] &&
              d.ownerId === where['ownerId'] &&
              d.kind === where['kind'] &&
              (where['status'] === undefined || d.status === where['status']),
          ) ?? null
        );
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        docs.find((d) => d.id === where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Omit<DocRow, 'id' | 'createdAt'> }) => {
        const row: DocRow = {
          ...data,
          id: `doc-${docs.length + 1}`,
          createdAt: new Date(),
          metadata: (data as { metadata?: Record<string, unknown> }).metadata ?? {},
        } as DocRow;
        docs.push(row);
        return { id: row.id };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<DocRow> }) => {
        let count = 0;
        for (const d of docs) {
          if (
            d.ownerType === where['ownerType'] &&
            d.ownerId === where['ownerId'] &&
            d.kind === where['kind'] &&
            d.status === where['status']
          ) {
            Object.assign(d, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    application: {
      findUnique: vi.fn(async () => seed.application),
    },
    auditOutbox: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      }),
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(fake);
    },
  };
  return fake;
}

function makeFakeStorage() {
  const puts: Array<Record<string, unknown>> = [];
  return {
    puts,
    storage: 'local-fs',
    put: vi.fn(async (args: Record<string, unknown>) => {
      puts.push(args);
    }),
    presignedReadUrl: vi.fn(async (args: { key: string }) => `https://signed.example/${args.key}`),
  };
}

const baseApp = {
  id: 'app-1',
  status: 'declined',
  declineReasonCodes: ['credit_score_below_threshold', 'debt_to_income_too_high'],
  requestedAmountCents: 1_000_000n,
  termMonths: 36,
  category: 'personal',
  decisionAt: new Date('2026-05-27T12:00:00Z'),
  policyVersion: 'reg-b-2026-05-02',
  userId: 'user-1',
  user: { email: 'jane@example.com', phoneE164: '+15551112222', consumerProfile: null },
  offers: [],
};

describe('ComplianceDocService.generateAdverseActionNoticeForApplication', () => {
  it('renders + persists a Document + storage object + audit entry on first call', async () => {
    const prisma = makeFakePrisma({ application: baseApp });
    const storage = makeFakeStorage();
    const svc = new ComplianceDocService(prisma as never, storage as never, 'doc-bucket');
    const r = await svc.generateAdverseActionNoticeForApplication('app-1');

    expect(r.isNew).toBe(true);
    expect(r.supersededDocumentId).toBeNull();
    expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.sizeBytes).toBeGreaterThan(1000);
    expect(prisma.docs).toHaveLength(1);
    expect(prisma.docs[0]!.kind).toBe('adverse_action_notice');
    expect(prisma.docs[0]!.status).toBeUndefined(); // status defaults at DB layer
    expect(storage.puts).toHaveLength(1);
    expect(storage.puts[0]!['contentType']).toBe('application/pdf');
    expect(prisma.audits).toHaveLength(1);
    expect(prisma.audits[0]!['action']).toBe('compliance.adverse_action_notice.generated');
  });

  it('is idempotent: a second call returns the existing doc with isNew=false', async () => {
    const existing: DocRow = {
      id: 'doc-pre',
      ownerType: 'Application',
      ownerId: 'app-1',
      kind: 'adverse_action_notice',
      status: 'active',
      sha256: 'a'.repeat(64),
      sizeBytes: 4242,
      createdAt: new Date(),
      metadata: {},
    };
    const prisma = makeFakePrisma({ application: baseApp, existingDoc: existing });
    const storage = makeFakeStorage();
    const svc = new ComplianceDocService(prisma as never, storage as never, 'doc-bucket');
    const r = await svc.generateAdverseActionNoticeForApplication('app-1');
    expect(r).toEqual({
      documentId: 'doc-pre',
      sha256: 'a'.repeat(64),
      sizeBytes: 4242,
      isNew: false,
      supersededDocumentId: null,
    });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('throws when the application does not exist', async () => {
    const prisma = makeFakePrisma({ application: null });
    const svc = new ComplianceDocService(
      prisma as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    await expect(svc.generateAdverseActionNoticeForApplication('app-x')).rejects.toThrow();
  });

  it('refuses to render for an application whose status is not "declined"', async () => {
    const prisma = makeFakePrisma({
      application: { ...baseApp, status: 'approved' },
    });
    const svc = new ComplianceDocService(
      prisma as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    await expect(svc.generateAdverseActionNoticeForApplication('app-1')).rejects.toThrow(
      /status=approved/,
    );
  });

  it('refuses to render when declineReasonCodes is empty (Reg B requires specifics)', async () => {
    const prisma = makeFakePrisma({
      application: { ...baseApp, declineReasonCodes: [] },
    });
    const svc = new ComplianceDocService(
      prisma as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    await expect(svc.generateAdverseActionNoticeForApplication('app-1')).rejects.toThrow(
      /missing declineReasonCodes/,
    );
  });

  it('rejects recipientOverride without supersedePrior=true (fails closed)', async () => {
    const prisma = makeFakePrisma({ application: baseApp });
    const svc = new ComplianceDocService(
      prisma as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    await expect(
      svc.generateAdverseActionNoticeForApplication('app-1', {
        recipientOverride: { legalName: 'Jane Doe' },
      }),
    ).rejects.toThrow(/recipientOverride requires supersedePrior/);
  });

  it('supersede flow: marks the prior active doc superseded, writes a new one, logs the regenerated audit', async () => {
    const existing: DocRow = {
      id: 'doc-old',
      ownerType: 'Application',
      ownerId: 'app-1',
      kind: 'adverse_action_notice',
      status: 'active',
      sha256: 'b'.repeat(64),
      sizeBytes: 1000,
      createdAt: new Date(),
      metadata: {},
    };
    const prisma = makeFakePrisma({ application: baseApp, existingDoc: existing });
    const storage = makeFakeStorage();
    const svc = new ComplianceDocService(prisma as never, storage as never, 'doc-bucket');
    const r = await svc.generateAdverseActionNoticeForApplication('app-1', {
      recipientOverride: { legalName: 'Jane Q. Public' },
      supersedePrior: true,
    });
    expect(r.isNew).toBe(true);
    expect(r.supersededDocumentId).toBe('doc-old');
    expect(prisma.docs.find((d) => d.id === 'doc-old')!.status).toBe('superseded');
    expect(prisma.audits[0]!['action']).toBe('compliance.adverse_action_notice.regenerated');
  });

  it('bureau key-factors path (§615(a) FCRA): bureau-included render is meaningfully larger than the no-bureau render', async () => {
    // pdfkit compresses page-content streams, so we cannot scan for
    // visible body text inside the uploaded Buffer. We characterise the
    // §615(a) path by comparing PDF byte length: the bureau block adds
    // bureau identity + score disclosure + the 4-line key-factors list
    // + the FCRA free-disclosure paragraph, which yields ≥500 extra
    // bytes vs the bureau-less notice.
    const prismaA = makeFakePrisma({ application: baseApp });
    const storageA = makeFakeStorage();
    const svcA = new ComplianceDocService(prismaA as never, storageA as never, 'doc-bucket');
    await svcA.generateAdverseActionNoticeForApplication('app-1');
    const sizeA = (storageA.puts[0]!['body'] as Buffer).length;

    const prismaB = makeFakePrisma({ application: baseApp });
    const storageB = makeFakeStorage();
    const svcB = new ComplianceDocService(prismaB as never, storageB as never, 'doc-bucket');
    await svcB.generateAdverseActionNoticeForApplication('app-1', {
      bureau: {
        name: 'Experian',
        addressLine1: '475 Anton Blvd',
        city: 'Costa Mesa',
        state: 'CA',
        zip: '92626',
        phone: '1-888-397-3742',
        score: 640,
        scoreRangeDisplay: '300-850',
        keyFactors: [
          'Length of credit history',
          'High utilisation',
          'Recent inquiries',
          'Account age mix',
        ],
      },
    });
    const sizeB = (storageB.puts[0]!['body'] as Buffer).length;
    expect(sizeB).toBeGreaterThan(sizeA + 500);
  });

  it('fires notify(application.declined) with documentId payload when a NotifyPort is wired', async () => {
    const prisma = makeFakePrisma({ application: baseApp });
    const storage = makeFakeStorage();
    const notify = { notify: vi.fn(async () => undefined) };
    const svc = new ComplianceDocService(
      prisma as never,
      storage as never,
      'doc-bucket',
      notify as never,
    );
    const r = await svc.generateAdverseActionNoticeForApplication('app-1');
    // Notify is fired but not awaited inside the method (void). Give the
    // event loop one tick.
    await new Promise((res) => setImmediate(res));
    expect(notify.notify).toHaveBeenCalledOnce();
    const call = notify.notify.mock.calls[0]![0]!;
    expect(call).toMatchObject({
      userId: 'user-1',
      templateKey: 'application.declined',
      subjectType: 'Application',
      subjectId: 'app-1',
    });
    expect((call.payload as { documentId: string }).documentId).toBe(r.documentId);
  });

  it('stamps a 25-month retainUntil on the new Document', async () => {
    const prisma = makeFakePrisma({ application: baseApp });
    const svc = new ComplianceDocService(
      prisma as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    const before = new Date();
    await svc.generateAdverseActionNoticeForApplication('app-1');
    const created = prisma.docs[0] as unknown as { retainUntil: Date };
    const expected = new Date(before);
    expected.setUTCMonth(expected.getUTCMonth() + 25);
    // Allow a small clock-skew tolerance (test runtime).
    expect(Math.abs(created.retainUntil.getTime() - expected.getTime())).toBeLessThan(5_000);
  });

  it.todo(
    'computes aan_due_by = decisioned_at + 30d on the Application/Document row (RULE: 30-day Reg B delivery SLA — not yet implemented in legacy)',
  );

  it.todo(
    'enforces a ≥4 reason-code hard cap at the builder layer (Reg B specificity — not yet enforced; spec calls for hard cap)',
  );
});

describe('ComplianceDocService.presignedDownloadUrl + getDocumentForOwner + findAdverseActionForApplication', () => {
  it('presignedDownloadUrl returns a 15-minute TTL URL with filename', async () => {
    const existing: DocRow = {
      id: 'd-1',
      ownerType: 'Application',
      ownerId: 'app-1',
      kind: 'adverse_action_notice',
      status: 'active',
      sha256: 'c'.repeat(64),
      sizeBytes: 1234,
      createdAt: new Date(),
      metadata: {},
    };
    const prisma = makeFakePrisma({ application: baseApp, existingDoc: existing });
    // patch findUnique on doc to return our row
    prisma.document.findUnique = vi.fn(async () => ({
      ...existing,
      storageKey: 'applications/app-1/aan.pdf',
      filename: 'aan-app-1.pdf',
    })) as never;
    const storage = makeFakeStorage();
    const svc = new ComplianceDocService(prisma as never, storage as never, 'doc-bucket');
    const r = await svc.presignedDownloadUrl('d-1');
    expect(r.url).toMatch(/^https:\/\/signed\.example\//);
    expect(r.expiresInSeconds).toBe(900);
  });

  it('presignedDownloadUrl throws document_not_found for unknown id', async () => {
    const prisma = makeFakePrisma({ application: baseApp });
    prisma.document.findUnique = vi.fn(async () => null) as never;
    const svc = new ComplianceDocService(
      prisma as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    await expect(svc.presignedDownloadUrl('nope')).rejects.toThrow();
  });

  it('getDocumentForOwner refuses cross-owner reads', async () => {
    const prisma = makeFakePrisma({ application: baseApp });
    prisma.document.findFirst = vi.fn(async () => null) as never;
    const svc = new ComplianceDocService(
      prisma as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    await expect(
      svc.getDocumentForOwner({ documentId: 'd-1', ownerType: 'Application', ownerId: 'other' }),
    ).rejects.toThrow();
  });

  it('findAdverseActionForApplication returns the active doc id or null', async () => {
    const existing: DocRow = {
      id: 'd-1',
      ownerType: 'Application',
      ownerId: 'app-1',
      kind: 'adverse_action_notice',
      status: 'active',
      sha256: 'c'.repeat(64),
      sizeBytes: 1234,
      createdAt: new Date(),
      metadata: {},
    };
    const prisma = makeFakePrisma({ application: baseApp, existingDoc: existing });
    const svc = new ComplianceDocService(
      prisma as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    expect(await svc.findAdverseActionForApplication('app-1')).toMatchObject({ id: 'd-1' });
    const empty = makeFakePrisma({ application: baseApp });
    const svc2 = new ComplianceDocService(
      empty as never,
      makeFakeStorage() as never,
      'doc-bucket',
    );
    expect(await svc2.findAdverseActionForApplication('app-2')).toBeNull();
  });
});
