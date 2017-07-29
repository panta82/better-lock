class BetterLockError extends Error {
	constructor(name, message, incomingStack = null) {
		if (name) {
			super(`[${name}] ${message}`);
		} else {
			super(message);
		}
		this.lock_name = name;
		
		if (incomingStack) {
			const withoutFirstLine = incomingStack.split('\n').slice(1).join('\n');
			this.stack = this.stack + '\n    --------------------------------------------------------------------------------\n' + withoutFirstLine;
		}
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
		const message = `Waiting ${job} has timed out after ${new Date() - job.enqueued_at}ms`;
		super(name, message, job.incoming_stack);
		this.job = job;
	}
}

class ExecutionTimeoutError extends BetterLockError {
	constructor(name, job) {
		const message = `Executing ${job} has timed out after ${new Date() - job.executed_at}ms`;
		super(name, message, job.incoming_stack);
		this.job = job;
	}
}

class QueueOverflowError extends BetterLockError {
	constructor(name, job, strategy) {
		const message = `Too many pending jobs. ${job} was kicked out using the "${strategy}" strategy`;
		super(name, message, job.incoming_stack);
		this.job = job;
		this.strategy = strategy;
	}
}

module.exports = {
	BetterLockError,
	BetterLockInternalError,
	InvalidArgumentError,
	WaitTimeoutError,
	ExecutionTimeoutError,
	QueueOverflowError
};