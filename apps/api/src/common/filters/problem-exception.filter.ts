import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ProblemError, type Problem } from '@eazepay/shared-utils';
import { ZodError } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();
    const problem = this.toProblem(exception, req.url);

    if (problem.status >= 500) {
      this.logger.error(
        { problem, err: exception instanceof Error ? exception.stack : exception },
        problem.title,
      );
    }

    void res
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send(problem);
  }

  private toProblem(exception: unknown, instance: string): Problem {
    if (exception instanceof ProblemError) {
      return { ...exception.problem, instance };
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
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
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
      };
    }

    return {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'internal_error',
      instance,
    };
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
