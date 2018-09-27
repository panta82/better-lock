const { BetterLock } = require('./src/better_lock');
const errors = require('./src/errors');
const LockJob = require('./src/lock_job');
const options = require('./src/options');

BetterLock.BetterLock = BetterLock;

BetterLock.BetterLockError = errors.BetterLockError;
BetterLock.BetterLockInternalError = errors.BetterLockInternalError;
BetterLock.InvalidArgumentError = errors.InvalidArgumentError;
BetterLock.WaitTimeoutError = errors.WaitTimeoutError;
BetterLock.ExecutionTimeoutError = errors.ExecutionTimeoutError;
BetterLock.QueueOverflowError = errors.QueueOverflowError;

BetterLock.LockJob = LockJob;
BetterLock.Options = options.BetterLockOptions;

/**
 * @type {OverflowStrategies}
 */
BetterLock.OVERFLOW_STRATEGIES = options.OVERFLOW_STRATEGIES;

module.exports = BetterLock;
