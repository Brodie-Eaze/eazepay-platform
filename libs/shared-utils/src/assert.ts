import { InternalError } from './problem.js';

export function assert(condition: unknown, message = 'Invariant violated'): asserts condition {
  if (!condition) {
    throw InternalError({ detail: message });
  }
}

export const exhaustive = (value: never, context?: string): never => {
  throw InternalError({
    detail: `Exhaustive check failed${context ? ` in ${context}` : ''}: ${String(value)}`,
  });
};
