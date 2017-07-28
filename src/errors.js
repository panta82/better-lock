class BetterLockError extends Error {
	constructor(name, message) {
		if (name) {
			super(`[${name}] ${message}`);
		} else {
			super(message);
		}
	}
}

class BetterLockInternalError extends Error {
	constructor(name, message) {
		const lastChar = message[message.length - 1];
		if (lastChar !== '.' && lastChar !== '!' && lastChar !== '?') {
			message += '.';
		}
		super(name, message + ' This is probably a bug inside "better-lock" library');
	}
}

class InvalidArgumentError extends BetterLockError {
	constructor(name, argument, expected, actual) {
		super(name, `Argument "${argument}" must be ${expected} (got: "${actual}")`);
	}
}

module.exports = {
	BetterLockError,
	BetterLockInternalError,
	InvalidArgumentError
};