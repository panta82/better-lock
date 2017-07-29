const tools = require('./tools');

const {DEFAULT_OPTIONS, OVERFLOW_STRATEGIES, OPTION_ALIASES} = require('./consts');
const LockJob = require('./lock_job');
const {BetterLockInternalError, InvalidArgumentError, WaitTimeoutError, ExecutionTimeoutError, QueueOverflowError} = require('./errors');

function BetterLock(options = DEFAULT_OPTIONS) {
	options = Object.assign({}, DEFAULT_OPTIONS, options);
	
	if (!(options.queue_size === null || options.queue_size >= 0)) {
		throw new InvalidArgumentError(options.name, 'queue_size', `null, 0 or a positive number`, options.queue_size);
	}
	if (!OVERFLOW_STRATEGIES[options.overflow_strategy]) {
		throw new InvalidArgumentError(options.name, 'overflow_strategy', `one of (${Object.keys(options.overflow_strategy).join(',')})`, options.overflow_strategy);
	}
	
	const log = tools.makeLog(options.name, options.log);
	
	const _noKeyQueue = [];
	const _keyQueues = {};
	
	Object.assign(this, /** @lends {BetterLock.prototype} */ {
		acquire
	});
	
	/**
	 * Acquire lock. Once the lock is acquired, we will call the executor function, with a "done" method.
	 * You must call "done" to release the lock. If acquire fails, callback will be called with appropriate error.
	 * Callback will also be called with whatever exit arguments you pass to done, so you can do all your cleanup
	 * code there.
	 * @param {string|undefined} [key] Named key for this particular call. Calls with different keys will be run in parallel. Not mandatory.
	 * @param {function} executor Function that will run inside the lock
	 * @param {function} [callback] Function to be called after the executor finishes or if we never enter the lock (timeout, queue depletion).
	 * @param {object} [jobOptions] job options (mostly timeouts), to be applied on this job only
	 */
	function acquire(key, executor, callback, jobOptions = null) {
		// Repackage "key". Must be string or undefined
		if (key === null) {
			key = undefined;
		}
		else if (!tools.isString(key) && key !== undefined) {
			jobOptions = callback;
			callback = executor;
			executor = key;
			key = undefined;
		}
		
		// Create callback wrapper for promise interface
		if (!tools.isFunction(callback)) {
			if (jobOptions === undefined) {
				jobOptions = callback;
			}
			
			callback = tools.callbackWithPromise();
		}
		
		// Validate the most important parts
		if (!tools.isString(key) && key !== undefined) {
			throw new InvalidArgumentError(options.name, 'key', 'a string or undefined', key);
		}
		if (!tools.isFunction(executor)) {
			throw new InvalidArgumentError(options.name, 'executor', 'a function', executor);
		}
		if (!tools.isFunction(callback)) {
			throw new InvalidArgumentError(options.name, 'callback', 'a function', callback);
		}
		
		const queue = key !== undefined
			? _keyQueues[key] || (_keyQueues[key] = [])
			: _noKeyQueue;
		
		const job =  new LockJob(key, executor, callback);
		job.wait_timeout = getOption('wait_timeout', jobOptions);
		job.execution_timeout = getOption('execution_timeout', jobOptions);
		
		if (getOption('extend_stack_traces', jobOptions)) {
			const tempErr = new Error();
			Error.captureStackTrace(tempErr, acquire);
			job.incoming_stack = tempErr.stack;
		}
		
		queue.push(job);
		
		log(`Enqueued ${job}`);
		
		setImmediate(update, queue);
		
		return callback.promise;
	}
	
	function getOption(key, customOptions) {
		const alias = OPTION_ALIASES[key];
		if (customOptions) {
			if (customOptions[key] !== undefined) {
				return customOptions[key];
			}
			if (alias && customOptions[alias] !== undefined) {
				return customOptions[alias];
			}
		}
		if (options[key] !== undefined) {
			return options[key];
		}
		if (alias && options[alias] !== undefined) {
			return options[alias];
		}
		return undefined;
	}
	
	function getQueue(key) {
		if (key === undefined) {
			return _noKeyQueue;
		}
		return _keyQueues[key];
	}
	
	/**
	 * @param {LockJob[]} queue
	 */
	function update(queue) {
		if (!queue) {
			throw new BetterLockInternalError(options.name, `update is called without a queue`);
		}
		
		if (!queue.executing && queue.length > 0) {
			// Execute next job
			queue.executing = queue.splice(0, 1)[0];
			executeJob(queue.executing);
		}
		
		if (options.queue_size !== null) {
			while (options.queue_size < queue.length) {
				// Overflow. Need to kick someone out
				let jobToKick;
				switch (options.overflow_strategy) {
					case OVERFLOW_STRATEGIES.kick_first:
						jobToKick = queue[0];
						break;
					
					case OVERFLOW_STRATEGIES.kick_last:
						jobToKick = queue[queue.length - 2];
						break;
					
					case OVERFLOW_STRATEGIES.reject:
						jobToKick = queue[queue.length - 1];
						break;
					
					default:
						throw new BetterLockInternalError(options.name, `Unexpected overflow strategy: ${options.overflow_strategy}`);
				}
				
				log(`Queue "${jobToKick.key}" has overflown, so ${jobToKick} was kicked out using the "${options.overflow_strategy}" strategy`);
				endJob(jobToKick, [new QueueOverflowError(options.name, jobToKick, options.overflow_strategy)]);
			}
		}
		
		for (let i = 0; i < queue.length; i++) {
			const job = queue[i];
			
			if (tools.isNumber(job.wait_timeout) && !job.wait_timeout_ptr) {
				// Job has been added, it's waiting, but no wait timeout was set. Set the timeout now.
				job.wait_timeout_ptr = setTimeout(onWaitTimeout.bind(null, job), job.wait_timeout);
			}
		}
	}
	
	/**
	 * @param {LockJob} job
	 */
	function executeJob(job) {
		log(`Executing ${job}`);
		job.executed_at = new Date();
		
		clearTimeout(job.wait_timeout_ptr);
		job.wait_timeout_ptr = null;
		
		if (tools.isNumber(job.execution_timeout)) {
			job.execution_timeout_ptr = setTimeout(onExecutionTimeout.bind(null, job), job.execution_timeout);
		}
		
		if (job.executor.length > 0) {
			// Callback interface
			job.executor(lockDone);
			return;
		}
		
		// Promise interface
		let promise;
		try {
			promise = job.executor();
		}
		catch (err) {
			// Error thrown directly from executor
			lockDone(err);
		}
		
		if (promise instanceof Promise) {
			promise
				.then(res => lockDone(null, res))
				.catch(err => lockDone(err));
		} else {
			// Promise is just the result value we don't have to wait
			lockDone(null, promise);
		}
		
		function lockDone() {
			log(`Done called for ${job}`);
			
			endJob(job, arguments);
		}
	}
	
	/**
	 * @param {LockJob} job
	 */
	function onWaitTimeout(job) {
		log(`${job} has timed out after waiting in queue for ${new Date() - job.enqueued_at}ms`);
		
		endJob(job, [new WaitTimeoutError(options.name, job)]);
	}
	
	/**
	 * @param {LockJob} job
	 */
	function onExecutionTimeout(job) {
		log(`${job} has timed out after executing for ${new Date() - job.executed_at}ms`);
		
		endJob(job, [new ExecutionTimeoutError(options.name, job)]);
	}
	
	/**
	 * @param {LockJob} job
	 * @param {*[]|Array|Arguments} callbackArgs
	 */
	function endJob(job, callbackArgs) {
		if (job.ended_at) {
			log(`${job} is trying to end, but it has already ended at ${job.ended_at.toISOString()}. Called with arguments: ${callbackArgs}`);
			return;
		}
		
		clearTimeout(job.wait_timeout_ptr);
		job.wait_timeout_ptr = null;
		
		clearTimeout(job.execution_timeout_ptr);
		job.execution_timeout_ptr = null;
		
		job.ended_at = new Date();
		
		const queue = getQueue(job.key);
		if (!queue) {
			throw new BetterLockInternalError(options.name, `Couldn't find queue for key "${job.key}"`);
		}
		
		if (queue.executing === job) {
			// If this was currently executing job, clear that spot
			queue.executing = null;
		} else {
			// If this was an enqueued job, dequeue it
			const index = queue.indexOf(job);
			if (index >= 0) {
				queue.splice(index, 1);
			} else {
				// Something is wrong. Where did this job come from?
				throw new BetterLockInternalError(options.name, `${job} is neither currently executing, nor enqueued.`);
			}
		}
		
		job.callback.apply(null, callbackArgs);
		
		setImmediate(update, queue);
	}
}

module.exports = {
	BetterLock
};