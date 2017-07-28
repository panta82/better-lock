class BetterLockError extends Error {
	constructor(name, message) {
		if (name) {
			super(`[${name}] ${message}`);
		} else {
			super(message);
		}
		this.lock_name = name;
	}
}

class BetterLockInternalError extends BetterLockError {
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
		this.argument = argument;
	}
}

class WaitTimeoutError extends BetterLockError {
	constructor(name, job) {
		const message = `Waiting job ${job} has timed out after ${new Date() - job.enqueued_at}ms`;
		super(name, message);
		this.job = job;
	}
}

module.exports = {
	BetterLockError,
	BetterLockInternalError,
	InvalidArgumentError,
	WaitTimeoutError
};