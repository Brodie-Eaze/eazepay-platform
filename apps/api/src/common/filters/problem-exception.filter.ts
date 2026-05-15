import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ProblemError, type Problem } from '@eazepay/shared-utils';
import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { loadEnv } from '../../config/env.js';

@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();

    // SEC-051 — every response carries a correlation id so support can
    // tie a 5xx the user reports ("error happened at 14:23 with code
    // internal_error") to the server-side log entry that DOES have the
    // stack trace. Fastify exposes `req.id` already; we use it if
    // present, otherwise mint a fresh uuid. The id is set as both the
    // response header `X-Request-Id` and folded into the log entry so
    // grep-by-id works from either side.
    const requestId =
      (req as { id?: string }).id ?? randomUUID();
    void res.header('X-Request-Id', requestId);

    const problem = this.toProblem(exception, req.url, requestId);

    if (problem.status >= 500) {
      // SEC-051 — log the FULL exception server-side at error level.
      // The client response (built by toProblem) strips title/detail
      // to a fixed string in production so we don't leak schema /
      // path / stack info to a caller. The log entry retains
      // everything for incident response.
      this.logger.error(
        {
          requestId,
          path: req.url,
          err: exception instanceof Error ? exception.stack : exception,
          rawMessage:
            exception instanceof Error ? exception.message : undefined,
        },
        `5xx: ${problem.title}`,
      );
    }

    void res
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }

  private toProblem(
    exception: unknown,
    instance: string,
    requestId: string,
  ): Problem {
    if (exception instanceof ProblemError) {
      return { ...exception.problem, instance, requestId } as Problem;
    }

    if (exception instanceof ZodError) {
      return {
        type: 'about:blank',
        title: 'Validation failed',
        status: 422,
        code: 'validation_failed',
        instance,
        errors: exception.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
        requestId,
      } as Problem;
    }

    // SEC-051 — production stripping for HttpException + the generic
    // catch-all. Threat being closed: pre-fix, the HttpException
    // branch echoed `exception.message` straight to the client as
    // `title` / `detail`. NestJS bubbles internal failure messages
    // (Prisma constraint names, deeply-nested validator output,
    // sometimes raw stack fragments) through HttpException, so a 500
    // would leak schema-internal phrasing — useful to an attacker
    // probing for endpoints + table shape. In production we collapse
    // every non-ProblemError / non-ZodError exception to a fixed
    // "Internal error" with no detail. In development we keep the
    // verbose form so debugging stays sane.
    const env = loadEnv();
    const inProd = env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (inProd && status >= 500) {
        return {
          type: 'about:blank',
          title: 'Internal error',
          status,
          code: this.codeForStatus(status),
          instance,
          requestId,
        } as Problem;
      }
      const r = exception.getResponse();
      const detail =
        typeof r === 'string'
          ? r
          : typeof (r as { message?: unknown }).message === 'string'
            ? ((r as { message: string }).message)
            : exception.message;
      return {
        type: 'about:blank',
        title: exception.message,
        status,
        code: this.codeForStatus(status),
        detail,
        instance,
        requestId,
      } as Problem;
    }

    // Generic catch-all — always opaque to the client, full detail
    // already went to the logger above.
    return {
      type: 'about:blank',
      title: inProd ? 'Internal error' : 'Internal Server Error',
      status: 500,
      code: 'internal_error',
      instance,
      requestId,
    } as Problem;
  }

  private codeForStatus(status: number): string {
    if (status === 400) return 'bad_request';
    if (status === 401) return 'unauthorized';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 409) return 'conflict';
    if (status === 422) return 'unprocessable_entity';
    if (status === 429) return 'too_many_requests';
    return 'internal_error';
  }
}
