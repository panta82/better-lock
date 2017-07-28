class BetterLockError extends Error {
	constructor(message) {
		super(message);
	}
}

class BetterLockInternalError extends Error {
	constructor(message) {
		const lastChar = message[message.length - 1];
		if (lastChar !== '.' && lastChar !== '!' && lastChar !== '?') {
			message += '.';
		}
		super(message + ' This is probably a bug inside "better-lock" library');
	}
}

class InvalidArgumentError extends BetterLockError {
	constructor(argument, expected, actual) {
		super(`Argument "${argument}" must be ${expected} (got: "${actual}")`);
	}
}

module.exports = {
	BetterLockError,
	BetterLockInternalError,
	InvalidArgumentError
};