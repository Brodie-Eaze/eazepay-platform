import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  NotFound,
  OBJECT_STORAGE,
  type ObjectStorage,
  sha256Hex,
} from '@eazepay/shared-utils';
import { NOTIFY_PORT, type NotifyPort } from '@eazepay/service-notification';
import { COMPLIANCE_DOC_BUCKET, PRISMA } from './internal/tokens.js';
import { buildAdverseActionNotice } from './notices/adverse-action-builder.js';
import { renderAdverseActionPdf } from './render/adverse-action-pdf.js';

const ADVERSE_ACTION_RETENTION_MONTHS = 25; // Reg B / FCRA decline retention

interface BureauContributor {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  score?: number;
  scoreRangeDisplay?: string;
  keyFactors?: string[];
}

@Injectable()
export class ComplianceDocService {
  private readonly logger = new Logger(ComplianceDocService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(COMPLIANCE_DOC_BUCKET) private readonly bucket: string,
    @Optional() @Inject(NOTIFY_PORT) private readonly notify?: NotifyPort,
  ) {}

  /**
   * Render and persist an Adverse Action Notice for a declined
   * application. Idempotent on the (application, kind) pair: if a
   * notice already exists with status='active' it is returned without
   * re-rendering.
   *
   * Inputs are pulled from the live row to avoid stale-data renders.
   * The result is a Document row + a stored PDF in object storage,
   * both anchored by SHA-256 of the rendered bytes.
   */
  async generateAdverseActionNoticeForApplication(
    applicationId: string,
    opts?: { policyVersion?: string; bureau?: BureauContributor },
  ): Promise<{ documentId: string; sha256: string; sizeBytes: number; isNew: boolean }> {
    // Idempotency: return existing active notice if present.
    const existing = await this.prisma.document.findFirst({
      where: {
        ownerType: 'Application',
        ownerId: applicationId,
        kind: 'adverse_action_notice',
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return {
        documentId: existing.id,
        sha256: existing.sha256,
        sizeBytes: existing.sizeBytes,
        isNew: false,
      };
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        user: { include: { consumerProfile: true } },
        offers: { take: 1 },
      },
    });
    if (!app) throw NotFound({ code: 'application_not_found' });
    if (app.status !== 'declined') {
      throw new Error(
        `compliance-doc: cannot render adverse-action notice for application status=${app.status}`,
      );
    }
    if (!app.declineReasonCodes || app.declineReasonCodes.length === 0) {
      throw new Error('compliance-doc: declined application missing declineReasonCodes');
    }

    // Lender of record fallback when no offer exists yet (orchestration
    // declined before any lender quoted): the partner bank our system
    // would have routed to. The placeholder below gets swapped for a
    // configured constant once the bank-partner contract is signed.
    const lenderOfRecord = {
      legalName: 'Partner Bank, N.A.',
      addressLine1: '123 Banking Way',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      servicerLine: 'EazePay Inc. — servicer for Partner Bank, N.A.',
    };

    const content = buildAdverseActionNotice({
      recipient: {
        legalName: 'Applicant', // PII unmask path replaces this in V1
        email: app.user.email,
        phone: app.user.phoneE164,
      },
      application: {
        id: app.id,
        amountDisplay: `$${(Number(app.requestedAmountCents) / 100).toFixed(2)}`,
        termDisplay: `${app.termMonths} month${app.termMonths === 1 ? '' : 's'}`,
        categoryDisplay: this.categoryDisplay(app.category),
        decisionDate: (app.decisionAt ?? new Date()).toISOString().slice(0, 10),
      },
      lenderOfRecord,
      reasonCodes: app.declineReasonCodes,
      ...(opts?.bureau ? { bureau: opts.bureau } : {}),
      policyVersion: opts?.policyVersion ?? app.policyVersion ?? 'unknown',
    });

    const pdf = await renderAdverseActionPdf(content);
    const sha = sha256Hex(pdf);
    const key = `applications/${applicationId}/adverse-action-${sha.slice(0, 12)}.pdf`;

    await this.storage.put({
      bucket: this.bucket,
      key,
      body: pdf,
      contentType: 'application/pdf',
      metadata: {
        applicationId,
        sha256: sha,
        policyVersion: content.policyVersion,
      },
    });

    const retainUntil = new Date();
    retainUntil.setUTCMonth(retainUntil.getUTCMonth() + ADVERSE_ACTION_RETENTION_MONTHS);

    const doc = await this.prisma.$transaction(async (tx) => {
      const d = await tx.document.create({
        data: {
          ownerType: 'Application',
          ownerId: applicationId,
          kind: 'adverse_action_notice',
          storage: this.storage.storage,
          storageKey: key,
          filename: `adverse-action-${app.id.slice(0, 8)}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: pdf.length,
          sha256: sha,
          retainUntil,
          metadata: {
            policyVersion: content.policyVersion,
            reasonCodes: content.reasonCodes,
            generatedAt: content.generatedAt,
          },
        },
        select: { id: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'service',
          actorId: null,
          action: 'compliance.adverse_action_notice.generated',
          targetType: 'Document',
          targetId: d.id,
          after: {
            applicationId,
            sha256: sha,
            sizeBytes: pdf.length,
            policyVersion: content.policyVersion,
          },
        },
      });
      return d;
    });

    if (this.notify) {
      void this.notify
        .notify({
          userId: app.userId,
          templateKey: 'application.declined',
          payload: { reasonCodes: content.reasonCodes, hasNotice: true, documentId: doc.id },
          subjectType: 'Application',
          subjectId: applicationId,
        })
        .catch((err) => this.logger.error({ err }, 'AAN notify failed'));
    }

    return { documentId: doc.id, sha256: sha, sizeBytes: pdf.length, isNew: true };
  }

  /**
   * Resolve a presigned URL for a Document. Caller is responsible for
   * authorisation (consumer can read their own; admin reads via the
   * admin guard). 15-minute TTL — sensitive content.
   */
  async presignedDownloadUrl(documentId: string): Promise<{
    url: string;
    filename: string;
    expiresInSeconds: number;
  }> {
    const d = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!d) throw NotFound({ code: 'document_not_found' });
    const url = await this.storage.presignedReadUrl({
      bucket: this.bucket,
      key: d.storageKey,
      ttlSeconds: 900,
      filename: d.filename,
    });
    return { url, filename: d.filename, expiresInSeconds: 900 };
  }

  async getDocumentForOwner(input: {
    documentId: string;
    ownerType: string;
    ownerId: string;
  }): Promise<{ id: string; ownerId: string; kind: string; sha256: string; createdAt: Date }> {
    const d = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
      },
      select: {
        id: true,
        ownerId: true,
        kind: true,
        sha256: true,
        createdAt: true,
      },
    });
    if (!d) throw NotFound({ code: 'document_not_found' });
    return d;
  }

  async findAdverseActionForApplication(applicationId: string): Promise<{ id: string } | null> {
    const d = await this.prisma.document.findFirst({
      where: {
        ownerType: 'Application',
        ownerId: applicationId,
        kind: 'adverse_action_notice',
        status: 'active',
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return d;
  }

  private categoryDisplay(c: string): string {
    switch (c) {
      case 'auto':
        return 'Auto';
      case 'home_improvement':
        return 'Home Improvement';
      case 'medical':
        return 'Medical';
      case 'retail':
        return 'Retail';
      case 'consolidation':
        return 'Debt Consolidation';
      case 'personal':
      default:
        return 'Personal';
    }
  }
}
