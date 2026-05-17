// RFC 7807 Problem Details. Stable `code` lets clients dispatch on errors
// without parsing strings. Never include internal stack/error text in `detail`.

export interface Problem {
  type: string; // URI reference
  title: string;
  status: number;
  code: string; // app-stable code
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string; code?: string }>;
}

export class ProblemError extends Error {
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.title);
    this.problem = problem;
    this.name = 'ProblemError';
  }
}

const make =
  (status: number, defaultCode: string, defaultTitle: string, type: string) =>
  (overrides: Partial<Omit<Problem, 'status' | 'type'>> = {}): ProblemError =>
    new ProblemError({
      type,
      status,
      title: overrides.title ?? defaultTitle,
      code: overrides.code ?? defaultCode,
      ...(overrides.detail !== undefined && { detail: overrides.detail }),
      ...(overrides.instance !== undefined && { instance: overrides.instance }),
      ...(overrides.errors !== undefined && { errors: overrides.errors }),
    });

export const BadRequest = make(400, 'bad_request', 'Bad Request', 'about:blank');
export const Unauthorized = make(401, 'unauthorized', 'Unauthorized', 'about:blank');
export const Forbidden = make(403, 'forbidden', 'Forbidden', 'about:blank');
export const NotFound = make(404, 'not_found', 'Not Found', 'about:blank');
export const Conflict = make(409, 'conflict', 'Conflict', 'about:blank');
export const UnprocessableEntity = make(
  422,
  'unprocessable_entity',
  'Unprocessable Entity',
  'about:blank',
);
export const TooManyRequests = make(429, 'too_many_requests', 'Too Many Requests', 'about:blank');
export const InternalError = make(500, 'internal_error', 'Internal Server Error', 'about:blank');
