const {BetterLock} = require('./src/better_lock');
const errors = require('./src/errors');
const LockJob = require('./src/lock_job');
const DEFAULT_OPTIONS = require('./src/default_options');

BetterLock.BetterLock = BetterLock;

BetterLock.BetterLockError = errors.BetterLockError;
BetterLock.BetterLockInternalError = errors.BetterLockInternalError;
BetterLock.InvalidArgumentError = errors.InvalidArgumentError;
BetterLock.WaitTimeoutError = errors.WaitTimeoutError;
BetterLock.ExecutionTimeoutError = errors.ExecutionTimeoutError;

BetterLock.LockJob = LockJob;

BetterLock.DEFAULT_OPTIONS = DEFAULT_OPTIONS;

module.exports = BetterLock;