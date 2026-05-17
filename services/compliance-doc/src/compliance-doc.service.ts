import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { NotFound, OBJECT_STORAGE, type ObjectStorage, sha256Hex } from '@eazepay/shared-utils';
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
   * application. Idempotent on the (application, kind) pair when
   * `recipientOverride` and `supersedePrior` are not set: if a notice
   * already exists with status='active' it is returned without
   * re-rendering.
   *
   * Pass `recipientOverride` (paired with the JIT PII unmask flow on
   * the admin side) to render a personalised notice; the prior active
   * notice is then marked status='superseded' and a new Document row
   * + new SHA-256 + new object-storage key replace it.
   */
  async generateAdverseActionNoticeForApplication(
    applicationId: string,
    opts?: {
      policyVersion?: string;
      bureau?: BureauContributor;
      /** Override the "Applicant" placeholder; usually sourced from a
       *  JIT PII unmask read. */
      recipientOverride?: {
        legalName: string;
        address?: {
          line1: string;
          line2?: string;
          city: string;
          state: string;
          zip: string;
        };
      };
      /** When true, an existing active notice is marked superseded and
       *  the new render becomes the active one. Caller is responsible
       *  for the audit row that explains why (typically an admin
       *  regenerate action). Required when recipientOverride is set. */
      supersedePrior?: boolean;
    },
  ): Promise<{
    documentId: string;
    sha256: string;
    sizeBytes: number;
    isNew: boolean;
    supersededDocumentId: string | null;
  }> {
    if (opts?.recipientOverride && !opts.supersedePrior) {
      throw new Error('compliance-doc: recipientOverride requires supersedePrior=true');
    }

    // Idempotency: return existing active notice if present AND we're
    // not asked to supersede.
    const existing = await this.prisma.document.findFirst({
      where: {
        ownerType: 'Application',
        ownerId: applicationId,
        kind: 'adverse_action_notice',
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing && !opts?.supersedePrior) {
      return {
        documentId: existing.id,
        supersededDocumentId: null,
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
      recipient: opts?.recipientOverride
        ? {
            legalName: opts.recipientOverride.legalName,
            email: app.user.email,
            phone: app.user.phoneE164,
            ...(opts.recipientOverride.address ? { address: opts.recipientOverride.address } : {}),
          }
        : {
            legalName: 'Applicant', // anonymous render — JIT unmask path personalises
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

    const result = await this.prisma.$transaction(async (tx) => {
      let supersededId: string | null = null;
      if (opts?.supersedePrior) {
        // Mark every existing active notice for this application as
        // superseded BEFORE inserting the new one. There is at most one
        // active row by uniqueness convention; updateMany covers
        // historical duplicates safely.
        const updated = await tx.document.updateMany({
          where: {
            ownerType: 'Application',
            ownerId: applicationId,
            kind: 'adverse_action_notice',
            status: 'active',
          },
          data: { status: 'superseded' },
        });
        if (updated.count > 0 && existing) {
          supersededId = existing.id;
        }
      }
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
            personalised: !!opts?.recipientOverride,
            ...(supersededId ? { supersededDocumentId: supersededId } : {}),
          },
        },
        select: { id: true },
      });
      await tx.auditOutbox.create({
        data: {
          actorType: 'service',
          actorId: null,
          action: supersededId
            ? 'compliance.adverse_action_notice.regenerated'
            : 'compliance.adverse_action_notice.generated',
          targetType: 'Document',
          targetId: d.id,
          after: {
            applicationId,
            sha256: sha,
            sizeBytes: pdf.length,
            policyVersion: content.policyVersion,
            personalised: !!opts?.recipientOverride,
            ...(supersededId ? { supersededDocumentId: supersededId } : {}),
          },
        },
      });
      return { id: d.id, supersededId };
    });

    if (this.notify) {
      void this.notify
        .notify({
          userId: app.userId,
          templateKey: 'application.declined',
          payload: {
            reasonCodes: content.reasonCodes,
            hasNotice: true,
            documentId: result.id,
            personalised: !!opts?.recipientOverride,
          },
          subjectType: 'Application',
          subjectId: applicationId,
        })
        .catch((err) => this.logger.error({ err }, 'AAN notify failed'));
    }

    return {
      documentId: result.id,
      supersededDocumentId: result.supersededId,
      sha256: sha,
      sizeBytes: pdf.length,
      isNew: true,
    };
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
