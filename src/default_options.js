module.exports = {
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
	 * Alias for "wait_timeout"
	 * @type {Number|null}
	 */
	waitTimeout: null,
	
	/**
	 * How long can a job be executing before timing out. Null to disable timeout.
	 * If you do that, though, and you have a swallowed callback, the lock can remain locked permanently.
	 * @type {Number|null}
	 */
	execution_timeout: null,
	
	/**
	 * Alias for "execution_timeout"
	 * @type {Number|null}
	 */
	executionTimeout: null,
};