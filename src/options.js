const OPTION_ALIASES = {
	waitTimeout: 'wait_timeout',
	executionTimeout: 'execution_timeout',
	queueSize: 'queue_size',
	overflowStrategy: 'overflow_strategy',
	extendStackTraces: 'extend_stack_traces',
};

/**
 * @class OverflowStrategies
 * @property {string} kick_first Remove the first (oldest) waiting job
 * @property {string} kick_last Remove the last (youngest) waiting job, and push the job you are trying to add in its place
 * @property {string} reject Reject any new job you are trying to add until the queue clears
 **/

/**
 * What to do when a queue overflows
 * @type {OverflowStrategies|string}
 */
const OVERFLOW_STRATEGIES = {
	kick_first: 'kick_first',
	kick_last: 'kick_last',
	reject: 'reject',
};

class BetterLockOptions {
	constructor(source) {
		/**
		 * Lock name. This will be written in all logs and error messages, to help you distinguish between different locks
		 * @type {string}
		 */
		this.name = '';

		/**
		 * Whether to log the internal actions. Set to true to use console.log. Alternatively, provide your own function
		 * @type {boolean|function}
		 */
		this.log = false;

		/**
		 * How long can jobs wait in queue before timing out. Null to disable timeout.
		 * @type {Number|null}
		 */
		this.wait_timeout = null;

		/**
		 * How long can a job be executing before timing out. Null to disable timeout.
		 * If you do that, though, and you have a swallowed callback, the lock can remain locked permanently.
		 * @type {Number|null}
		 */
		this.execution_timeout = null;

		/**
		 * Max queue size for waiting jobs.
		 * @type {Number|null}
		 */
		this.queue_size = null;

		/**
		 * What happens when queue overflows. One of OVERFLOW_STRATEGIES values.
		 * @type {string}
		 */
		this.overflow_strategy = OVERFLOW_STRATEGIES.reject;

		/**
		 * In any error produced by BetterLock, extend the stack trace to include income trace
		 * @type {boolean}
		 */
		this.extend_stack_traces = true;

		/**
		 * Function that detects whether value returned by executor is a promise.
		 * This will ducktype-sniff the returned value. Depending on your Promise library of choice,
		 * you might want to tighten or loosen this bit.
		 * @type {function(p)}
		 */
		this.promise_tester = p => p && typeof p.then === 'function';

		Object.assign(this, source);

		// Apply option aliases
		for (const key in OPTION_ALIASES) {
			if (this[key] !== undefined) {
				this[OPTION_ALIASES[key]] = this[key];
			}
		}
	}
}

module.exports = {
	OPTION_ALIASES,
	OVERFLOW_STRATEGIES,

	BetterLockOptions,
};
