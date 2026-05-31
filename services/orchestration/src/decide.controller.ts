import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import {
  aggregateDecision,
  decideRequestSchema,
  persistDecision,
  runDecision,
  type DecisionDisposition,
  type RankedLender,
} from './decision/engine/index.js';
import {
  BASIS_CIPHER_PORT,
  DECISION_REPOSITORY_PORT,
  DecisionPersistenceError,
  type BasisCipherPort,
  type DecisionRepositoryPort,
} from './decision/engine/persistence.port.js';
import {
  CATALOG_SOURCE_PORT,
  type CatalogSourcePort,
} from './decision/engine/catalog-source.port.js';

/**
 * POST /v1/decide — World A catalog-only prequal endpoint (P7b, ADR-0027).
 *
 * Stateless from the caller's point of view: given the same prequal inputs
 * and the same catalog state, the engine MUST produce the same decision.
 * Idempotency is enforced by the persistence layer: a retried request with
 * the same applicationId + inputs replays the stored decision without a
 * second write or a second engine run.
 *
 * Flow:
 *   1. Parse + validate the request body (Zod, strict).
 *   2. Load the enabled catalog from the DB via CatalogSourcePort.
 *   3. Run the engine: runDecision → aggregateDecision.
 *   4. Persist idempotently via persistDecision (ADR-0033).
 *   5. Return { decisionId, idempotencyKey, disposition, rankedLenders }.
 *
 * mlaCovered: the Military Lending Act MAPR-cap flag (ADR-0030) arrives with
 * the credit pull. No DMDC integration exists yet — the handler defaults to
 * false, which is safe for the civilian (World A) path. When DMDC lands,
 * pass the value from the credit-pull result.
 *
 * Auth: enforced at the app layer (JWT / API-key guard). This controller
 * carries no auth decorators so it is testable without a guard provider.
 */
@Controller()
export class DecideController {
  private readonly logger = new Logger(DecideController.name);

  constructor(
    @Inject(DECISION_REPOSITORY_PORT)
    private readonly repository: DecisionRepositoryPort,
    @Inject(BASIS_CIPHER_PORT)
    private readonly cipher: BasisCipherPort,
    @Inject(CATALOG_SOURCE_PORT)
    private readonly catalog: CatalogSourcePort,
  ) {}

  @Post('v1/decide')
  @HttpCode(200)
  async decide(@Body() body: unknown): Promise<DecideHttpResponse> {
    // ── 1. Parse ──────────────────────────────────────────────────────────
    const parsed = decideRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid decide request',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const request = parsed.data;

    // ── 2. Load catalog ───────────────────────────────────────────────────
    let products;
    try {
      products = await this.catalog.listEnabled();
    } catch (err) {
      this.logger.error(
        { err, applicationId: request.applicationId },
        'catalog.listEnabled failed',
      );
      throw new InternalServerErrorException('catalog_unavailable');
    }

    // ── 3. Run engine ─────────────────────────────────────────────────────
    // mlaCovered: defaults false until DMDC integration (ADR-0030).
    const mlaCovered = false;
    const runResult = runDecision(request, products, { mlaCovered });
    const aggregated = aggregateDecision(request, runResult);

    // ── 4. Persist idempotently ───────────────────────────────────────────
    let persisted;
    try {
      persisted = await persistDecision(
        { request, runResult, aggregated, merchantId: null, mlaCovered },
        {
          repository: this.repository,
          cipher: this.cipher,
          now: () => new Date(),
          newId: () => randomUUID(),
        },
      );
    } catch (err) {
      if (err instanceof DecisionPersistenceError) {
        // The basis was dead-lettered inside persistDecision; safe to 5xx.
        this.logger.error(
          {
            cause: (err as Error & { cause?: unknown }).cause,
            applicationId: request.applicationId,
          },
          'decision persist failed — basis dead-lettered',
        );
        throw new InternalServerErrorException('decision_persist_failed');
      }
      throw err;
    }

    // ── 5. Return wire response ───────────────────────────────────────────
    return {
      decisionId: persisted.decisionId,
      idempotencyKey: persisted.idempotencyKey,
      disposition: persisted.disposition,
      replayed: persisted.replayed,
      rankedLenders: persisted.response.rankedLenders,
    };
  }
}

/** HTTP response shape for POST /v1/decide. */
export interface DecideHttpResponse {
  decisionId: string;
  idempotencyKey: string;
  disposition: DecisionDisposition;
  /** True when the response was replayed from a prior identical request. */
  replayed: boolean;
  rankedLenders: RankedLender[];
}
