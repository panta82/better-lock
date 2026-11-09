import { ILockKey } from './types';

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

  /**
   * Before acquiring lock, call this function with the given key. If condition is rejected, the executor is immediately called, without locking.
   * This can be used to more conveniently opt out of locking, without duplicating or extracting the executor.
   * Overrides BetterLockOptions value.
   */
  lock_condition?: (key: ILockKey | Array<ILockKey>) => boolean;

  /**
   * What to do when acquire is called from code that already holds all the requested keys. Overrides BetterLockOptions value.
   */
  reentrancy?: IReentrancyMode;
}

export type IQueueEjectionStrategy = 'oldest' | 'newest';

/**
 * - 'allow': run the executor without waiting for the keys the caller already holds.
 * - 'error': fail with BetterLockReentrancyError.
 */
export type IReentrancyMode = 'allow' | 'error';

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
   * Before acquiring lock, call this function with the given key. If condition is rejected, the executor is immediately called, without locking.
   * This can be used to more conveniently opt out of locking, without duplicating or extracting the executor.
   */
  lock_condition?: (key: ILockKey | Array<ILockKey>) => boolean;

  /**
   * What to do when acquire is called from code that already holds all the requested keys (inside the executor, or
   * in async work the executor started and that runs before it finishes). 'allow' runs the executor without
   * waiting, 'error' fails with BetterLockReentrancyError. Defaults to 'allow'.
   *
   * Holding only some of the requested keys always fails with BetterLockReentrancyError, because waiting for the rest
   * while holding these could deadlock.
   *
   * Requires Node.js AsyncLocalStorage, looked up through process.getBuiltinModule (Node.js 20.16+ or 22.3+).
   * In other runtimes, this option has no effect and nested acquire calls wait in the queue like any other.
   */
  reentrancy?: IReentrancyMode;

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
