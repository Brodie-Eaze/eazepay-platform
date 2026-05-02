/**
 * Side-effect hook called *after* an application transitions to
 * `submitted`. The application service stays pure — orchestration,
 * notification fan-out, etc. plug in here.
 *
 * Default implementation in ApplicationModule.forRoot is a no-op so the
 * service is independently testable. apps/api wires
 * OrchestrationService.evaluate as the production hook.
 *
 * Implementations MUST be safe to invoke after the submit transaction
 * has already committed (the application is in `submitted` status when
 * the hook fires). Long-running work should be deferred to a queue.
 */
export interface PostSubmitHook {
  onSubmitted(applicationId: string): Promise<void>;
}

export const POST_SUBMIT_HOOK = Symbol('POST_SUBMIT_HOOK');
