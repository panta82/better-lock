const {BetterLock} = require('./src/better_lock');
const LockJob = require('./src/lock_job');
const errors = require('./src/errors');

BetterLock.BetterLock = BetterLock;

BetterLock.BetterLockError = errors.BetterLockError;
BetterLock.BetterLockInternalError = errors.BetterLockInternalError;
BetterLock.InvalidArgumentError = errors.InvalidArgumentError;
BetterLock.WaitTimeoutError = errors.WaitTimeoutError;

BetterLock.LockJob = LockJob;

module.exports = BetterLock;