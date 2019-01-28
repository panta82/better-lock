const { assign } = require('./tools');

const ALIASES = {
	waitTimeout: 'wait_timeout',
	executionTimeout: 'execution_timeout',
	queueSize: 'queue_size',
	overflowStrategy: 'overflow_strategy',
	extendStackTraces: 'extend_stack_traces',
};

/**
 * Options that apply on BetterLock instance
 */
class BetterLockOptions {
	constructor(/** BetterLockOptions|BetterLockOptions[] */ sources) {
		/**
		 * How long can jobs wait in queue before timing out. Null to disable timeout.
		 * @type {Number|null}
		 */
		this.wait_timeout = undefined;

		/**
		 * How long can a job be executing before timing out. Null to disable timeout.
		 * If you do that, though, and you have a swallowed callback, the lock can remain locked permanently.
		 * @type {Number|null}
		 */
		this.execution_timeout = undefined;

		/**
		 * Max queue size for waiting jobs.
		 * @type {Number|null}
		 */
		this.queue_size = undefined;

		/**
		 * Lock name. This will be written in all logs and error messages, to help you distinguish between different locks
		 * @type {string}
		 */
		this.name = undefined;

		/**
		 * Whether to log the internal actions. Set to true to use console.log. Alternatively, provide your own function
		 * @type {boolean|function}
		 */
		this.log = undefined;

		/**
		 * In any error produced by BetterLock, extend the stack trace to include incoming trace
		 * @type {boolean}
		 */
		this.extend_stack_traces = undefined;

		/**
		 * Function that detects whether value returned by executor is a promise.
		 * This will ducktype-sniff the returned value. Depending on your Promise library of choice,
		 * you might want to tighten or loosen this bit.
		 * @type {function(p)}
		 */
		this.promise_tester = p => p && typeof p.then === 'function';

		this.assign(sources);
	}

	assign(sources) {
		assign(this, sources, ALIASES);
	}
}

/**
 * Options that apply on LockJob
 */
class LockJobOptions {
	constructor(/** LockJobOptions|LockJobOptions[] */ sources) {
		/**
		 * How long can jobs wait in queue before timing out. Overrides BetterLockOptions value.
		 * @type {Number|null}
		 */
		this.wait_timeout = undefined;

		/**
		 * How long can a job be executing before timing out. Null to disable timeout. Overrides BetterLockOptions value.
		 * @type {Number|null}
		 */
		this.execution_timeout = undefined;

		/**
		 * In any error produced by BetterLock, extend the stack trace to include incoming trace. Overrides BetterLockOptions value.
		 * @type {boolean}
		 */
		this.extend_stack_traces = undefined;

		this.assign(sources);
	}

	assign(sources) {
		assign(this, sources, ALIASES);
	}
}

const DEFAULT_OPTIONS = new BetterLockOptions({
	extend_stack_traces: true,
});

module.exports = { BetterLockOptions, LockJobOptions, DEFAULT_OPTIONS };
