import { BetterLock as BetterLockUnadorned } from './better_lock';
import {
  BetterLockError,
  BetterLockExecutionTimeoutError,
  BetterLockInternalError,
  BetterLockInvalidArgumentError,
  BetterLockJobAbortedError,
  BetterLockQueueOverflowError,
  BetterLockWaitTimeoutError,
} from './errors';
import { ILockJobOptions as BetterLockJobOptions, IOptions as BetterLockOptions, IQueueEjectionStrategy as BetterLockQueueEjectionStrategy } from './options';
import {
  IErrorName as BetterLockErrorName,
  IExecutor as BetterLockExecutor,
  ILockKey as BetterLockKey,
} from './types';

export {
  BetterLockOptions,
  BetterLockQueueEjectionStrategy,
  BetterLockJobOptions,
  BetterLockExecutor,
  BetterLockKey,
  BetterLockErrorName,
  // Errors
  BetterLockError,
  BetterLockExecutionTimeoutError,
  BetterLockInternalError,
  BetterLockInvalidArgumentError,
  BetterLockJobAbortedError,
  BetterLockQueueOverflowError,
  BetterLockWaitTimeoutError,
};

function attachExports<TTarget, TExports extends { [key: string]: any }>(
  target: TTarget,
  exports: TExports
): TTarget & TExports {
  Object.assign(target, exports);
  return target as any;
}

export const BetterLock = attachExports(BetterLockUnadorned, {
  BetterLock: BetterLockUnadorned,

  Error: BetterLockError,
  InternalError: BetterLockInternalError,
  InvalidArgumentError: BetterLockInvalidArgumentError,
  WaitTimeoutError: BetterLockWaitTimeoutError,
  ExecutionTimeoutError: BetterLockExecutionTimeoutError,
  QueueOverflowError: BetterLockQueueOverflowError,
  JobAbortedError: BetterLockJobAbortedError,
});

export default BetterLock;
