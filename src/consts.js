const OPTION_ALIASES = {
	wait_timeout: 'waitTimeout',
	execution_timeout: 'executionTimeout',
	queue_size: 'queueSize',
	overflow_strategy: 'overflowStrategy'
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
	reject: 'reject'
};

const DEFAULT_OPTIONS = {
	/**
	 * Lock name. This will be written in all logs and error messages, to help you distinguish between different locks
	 * @type {string}
	 */
	name: '',
	
	/**
	 * Whether to log the internal actions. Set to true to use console.log. Alternatively, provide your own function
	 * @type {boolean|function}
	 */
	log: false,
	
	/**
	 * How long can jobs wait in queue before timing out. Null to disable timeout.
	 * @type {Number|null}
	 */
	wait_timeout: null,
	
	/**
	 * How long can a job be executing before timing out. Null to disable timeout.
	 * If you do that, though, and you have a swallowed callback, the lock can remain locked permanently.
	 * @type {Number|null}
	 */
	execution_timeout: null,
	
	/**
	 * Max queue size for waiting jobs.
	 * @type {Number|null}
	 */
	queue_size: null,
	
	/**
	 * What happens when queue overflows. One of OVERFLOW_STRATEGIES values.
	 * @type {string}
	 */
	overflow_strategy: OVERFLOW_STRATEGIES.reject,
	
	/**
	 * In any error produced by BetterLock, extend the stack trace to include income trace
	 * @type {boolean}
	 */
	extend_stack_traces: true
};

module.exports = {
	OPTION_ALIASES,
	OVERFLOW_STRATEGIES,
	DEFAULT_OPTIONS
};