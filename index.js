const {BetterLock} = require('./src/better_lock');
const errors = require('./src/errors');

BetterLock.BetterLock = BetterLock;

BetterLock.BetterLockError = errors.BetterLockError;
BetterLock.BetterLockInternalError = errors.BetterLockInternalError;
BetterLock.InvalidArgumentError = errors.InvalidArgumentError;

module.exports = BetterLock;