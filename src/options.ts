/**
 * Options that apply on LockJob
 */
export interface ILockJobOptions {
  /**
   * How long can jobs wait in queue before timing out. Overrides BetterLockOptions value.
   */
  wait_timeout?: number | null;

  /**
   * How long can a job be executing before timing out. Null to disable timeout. Overrides BetterLockOptions value.
   */
  execution_timeout?: number | null;

  /**
   * In any error produced by BetterLock, extend the stack trace to include incoming trace. Overrides BetterLockOptions value.
   */
  extend_stack_traces?: boolean;
}

export type IQueueEjectionStrategy = 'oldest' | 'newest';

/**
 * Options that apply on BetterLock instance
 */
export interface IOptions extends ILockJobOptions {
  /**
   * How long can jobs wait in queue before timing out. Null to disable timeout.
   */
  wait_timeout?: number | null;

  /**
   * How long can a job be executing before timing out. Null to disable timeout.
   * If you do that, though, and you have a swallowed callback, the lock can remain locked permanently.
   */
  execution_timeout?: number | null;

  /**
   * Max queue size for waiting jobs.
   */
  queue_size?: number | null;

  /**
   * If queue is full, which job to eject. Defaults to 'oldest'.
   */
  queue_ejection_strategy?: IQueueEjectionStrategy;

  /**
   * Lock name. This will be written in all logs and error messages, to help you distinguish between different locks
   */
  name?: string;

  /**
   * Whether to log the internal actions. Set to true to use console.log. Alternatively, provide your own function
   */
  log?: boolean | ((msg: string) => void);

  /**
   * In any error produced by BetterLock, extend the stack trace to include incoming trace.
   * Defaults to true.
   */
  extend_stack_traces?: boolean;

  /**
   * Function that detects whether value returned by executor is a promise.
   * This will ducktype-sniff the returned value. Depending on your Promise library of choice,
   * you might want to tighten or loosen this bit.
   */
  promise_tester?: (maybePromise: any) => boolean;
}
