const { BetterLock } = require('./src/better_lock');
const errors = require('./src/errors');
const { LockJob } = require('./src/types');
const { BetterLockOptions } = require('./src/options');

BetterLock.BetterLock = BetterLock;

BetterLock.BetterLockError = errors.BetterLockError;
BetterLock.BetterLockInternalError = errors.BetterLockInternalError;
BetterLock.InvalidArgumentError = errors.InvalidArgumentError;
BetterLock.WaitTimeoutError = errors.WaitTimeoutError;
BetterLock.ExecutionTimeoutError = errors.ExecutionTimeoutError;
BetterLock.QueueOverflowError = errors.QueueOverflowError;
BetterLock.JobAbortedError = errors.JobAbortedError;

BetterLock.LockJob = LockJob;
BetterLock.Options = BetterLockOptions;

module.exports = BetterLock;
