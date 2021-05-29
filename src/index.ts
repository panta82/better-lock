import { BetterLock as BetterLockUnadorned } from './better_lock';
import {
  BetterLockError,
  BetterLockInternalError,
  ExecutionTimeoutError,
  InvalidArgumentError,
  JobAbortedError,
  QueueOverflowError,
  WaitTimeoutError,
} from './errors';
import { BetterLockOptions } from './options';
import { IExecutor as BetterLockExecutor, ILockKey as BetterLockKey } from './types';

export { BetterLockOptions, BetterLockExecutor, BetterLockKey };

function attachExports<TTarget, TExports extends { [key: string]: any }>(
  target: TTarget,
  exports: TExports
): TTarget & TExports {
  Object.assign(target, exports);
  return target as any;
}

export const BetterLock = attachExports(BetterLockUnadorned, {
  BetterLock: BetterLockUnadorned,

  BetterLockError: BetterLockError,
  BetterLockInternalError: BetterLockInternalError,
  InvalidArgumentError: InvalidArgumentError,
  WaitTimeoutError: WaitTimeoutError,
  ExecutionTimeoutError: ExecutionTimeoutError,
  QueueOverflowError: QueueOverflowError,
  JobAbortedError: JobAbortedError,

  Options: BetterLockOptions,
});

export default BetterLock;
