const tools = require('./tools');

const { LockJob, KeyQueue } = require('./types');
const {
	BetterLockInternalError,
	InvalidArgumentError,
	WaitTimeoutError,
	ExecutionTimeoutError,
	QueueOverflowError,
} = require('./errors');
const { BetterLockOptions, LockJobOptions, DEFAULT_OPTIONS } = require('./options');

/**
 * BetterLock constructor.
 * @constructor
 * @param {BetterLockOptions} options
 */
function BetterLock(options) {
	options = new BetterLockOptions([BetterLock.DEFAULT_OPTIONS, options]);

	const log = tools.makeLog(options.name, options.log);

	/** @type {Object.<string, KeyQueue>} */
	const _queues = {};

	Object.assign(
		this,
		/** @lends {BetterLock.prototype} */ {
			canAcquire,
			acquire,
		}
	);

	// *******************************************************************************************************************

	/**
	 * Return or create a key queue for given key
	 * @return {KeyQueue}
	 */
	function getQueue(key) {
		if (key === undefined || key === null) {
			key = KeyQueue.DEFAULT_QUEUE_KEY;
		}
		let queue = _queues[key];
		if (!queue) {
			queue = _queues[key] = new KeyQueue(key);
		}
		return queue;
	}

	/**
	 * Returns true if the caller can *immediately* acquire the lock. There is nothing holding the key and nothing in the queue.
	 * @param key
	 */
	function canAcquire(key) {
		const queue = getQueue(key);
		return !queue.active && !queue.jobs.length;
	}

	function normalizeAndValidateKey(key) {
		if (key === undefined) {
			return undefined;
		}
		if (key === null) {
			return undefined;
		}
		if (tools.isString(key)) {
			return key;
		}
		if (tools.isNumber(key)) {
			return String(key);
		}
		// Invalid key value
		throw new InvalidArgumentError(
			options.name,
			'key',
			'a string, number, undefined, null, or an array of these types',
			key
		);
	}

	/**
	 * Acquire the lock for given key or list of keys. If waiting on a list, keys will be acquired in order,
	 * as they become free. Any deadlock prevention must be handled by the caller.
	 *
	 * Once the lock is acquired, we will call the executor function, with a "done" method.
	 * You must call "done" to release the lock. Alternatively, return a Promise; lock will be released
	 * once promise resolves or rejects.
	 *
	 * Return values from your executor will be passed to callback (or the resulting promise).
	 * @template T
	 * @param {string|Number|Array|undefined} [key] Named key or array of keys for this particular call. Calls with different keys will be run in parallel. Not required.
	 * @param {function(done):Promise<T>} executor Function that will run inside the lock. Required.
	 * @param {function} [callback] Function to be called after the executor finishes or if we never enter the lock (timeout, queue depletion). Leave out to use promises.
	 * @param {LockJobOptions} [jobOptions] Options to be applied on this job only
	 * @return {Promise<T>}
	 */
	function acquire(key, executor, callback, jobOptions = null) {
		if (tools.isFunction(key) || tools.isObject(key)) {
			// Presume we weren't given a key
			jobOptions = callback;
			callback = executor;
			executor = key;
			key = undefined;
		}

		// Repackage "key" into an array of keys
		const keys = [];
		if (tools.isArray(key)) {
			for (let i = 0; i < key.length; i++) {
				keys.push(normalizeAndValidateKey(key[i]));
			}
		} else {
			keys.push(normalizeAndValidateKey(key));
		}

		// Create callback wrapper for promise interface
		if (!tools.isFunction(callback)) {
			if (jobOptions === undefined) {
				jobOptions = callback;
			}

			callback = tools.callbackWithPromise();
		}

		// Validate other options
		if (!tools.isFunction(executor)) {
			throw new InvalidArgumentError(options.name, 'executor', 'a function', executor);
		}
		if (!tools.isFunction(callback)) {
			throw new InvalidArgumentError(options.name, 'callback', 'a function', callback);
		}

		// Prepare job options
		const effectiveJobOptions = jobOptions
			? new LockJobOptions([options, jobOptions])
			: // No need to create new object since these will be read-only and are subset of global options
			  options;

		const job = new LockJob(keys, executor, callback, effectiveJobOptions);

		// Set incoming stack
		if (effectiveJobOptions.extend_stack_traces) {
			const tempErr = new Error();
			Error.captureStackTrace(tempErr, acquire);
			job.incoming_stack = tempErr.stack;
		}

		// Add job to its key queues
		const queuesToUpdate = [];
		for (let i = 0; i < keys.length; i++) {
			const queue = getQueue(keys[i]);
			queue.jobs.push(job);
			queuesToUpdate.push(queue);
		}

		// Start wait timer, if enabled
		if (tools.isNumber(job.options.wait_timeout)) {
			job.wait_timeout_id = setTimeout(onWaitTimeout.bind(null, job), job.options.wait_timeout);

			// NOTE: timeout of 0 will NOT trigger error if lock can be acquired immediately.
		}

		log(`Enqueued ${job}`);

		// Perform update of queues this job has modified. We don't do this in next tick or something,
		// because we want canAcquire to immediately return false
		update(queuesToUpdate);

		return callback.promise;
	}

	/**
	 * Update state of given list of queues.
	 * @param {KeyQueue[]} queues
	 */
	function update(queues) {
		for (let i = 0; i < queues.length; i++) {
			const queue = queues[i];

			// If key is available, have next job grab it
			if (!queue.active && queue.jobs.length) {
				/** @type {LockJob} */
				const job = queue.jobs.splice(0, 1)[0];
				queue.active = job;
				job.waiting_count--;

				if (job.waiting_count <= 0) {
					// This job can be executed now.
					executeJob(job);
				}
			}

			// Handle wait queue overflow
			if (tools.isNumber(options.queue_size) && options.queue_size < queue.jobs.length) {
				// Overflow. Reject the most recent job
				const mostRecentJob = queue.jobs[queue.jobs.length - 1];
				log(
					`${queue.toString()} has overflown, so most recent job (${mostRecentJob}) was kicked out`
				);

				endJob(mostRecentJob, [
					new QueueOverflowError(options.name, queue.key, queue.jobs.length, mostRecentJob),
				]);
			}
		}
	}

	/**
	 * @param {LockJob} job
	 */
	function executeJob(job) {
		log(`Executing ${job}`);
		job.executed_at = new Date();

		for (let i = 0; i < job.keys.length; i++) {
			const queue = getQueue(job.keys[i]);
			if (queue.active !== job) {
				// This should never happen
				return endJob(job, [
					new BetterLockInternalError(options.name, `Corrupted wait queue state for ${queue.key}`),
				]);
			}
		}

		clearTimeout(job.wait_timeout_id);
		job.wait_timeout_id = null;

		// We want to do the rest of this in a separate context, because we don't want user executor code
		// to ever interfere with the code calling acquire().

		setImmediate(() => {
			if (tools.isNumber(job.options.execution_timeout)) {
				job.execution_timeout_id = setTimeout(
					onExecutionTimeout.bind(null, job),
					job.options.execution_timeout
				);
			}

			if (job.executor.length > 0) {
				// Callback interface
				job.executor(lockDone);
				return;
			}

			// Promise interface
			let executorResult;
			try {
				executorResult = job.executor();
			} catch (err) {
				// Error thrown directly from executor
				lockDone(err);
			}

			// Promise sniffing
			if (executorResult && executorResult.then && executorResult.catch) {
				executorResult.then(res => lockDone(null, res), err => lockDone(err));
			} else {
				// Promise is just the result value we don't have to wait
				lockDone(null, executorResult);
			}

			function lockDone() {
				log(`Done called for ${job}`);

				endJob(job, arguments);
			}
		});
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
	 * @param {*[]|Array|IArguments} callbackArgs
	 */
	function endJob(job, callbackArgs) {
		if (job.ended_at) {
			log(
				`WARNING: ${job} is trying to end, but it has already ended at ${job.ended_at.toISOString()}. Called with arguments: ${callbackArgs}`
			);
			return;
		}

		clearTimeout(job.wait_timeout_id);
		job.wait_timeout_id = null;

		clearTimeout(job.execution_timeout_id);
		job.execution_timeout_id = null;

		job.ended_at = new Date();

		const queuesToUpdate = [];
		for (let i = 0; i < job.keys.length; i++) {
			const queue = getQueue(job.keys[i]);
			queuesToUpdate.push(queue);

			if (queue.active === job) {
				// This job was holding on the queue's key
				queue.active = null;
			} else {
				// This job was still in wait list for this queue
				const index = queue.jobs.indexOf(job);
				if (index >= 0) {
					// Remove from queue
					queue.jobs.splice(index, 1);
				} else {
					// Something is wrong. Where did this job come from?
					log(
						`WARNING: ${job} is ending, but it is not found anywhere in the queue for ${queue.key}`
					);
				}
			}
		}

		// Call the callback
		try {
			job.callback.apply(null, callbackArgs);
		} finally {
			// Whatever happens, schedule a queue update
			setImmediate(update, queuesToUpdate);
		}
	}
}

/**
 * Default options to be used when creating BetterLock instances.
 */
BetterLock.DEFAULT_OPTIONS = DEFAULT_OPTIONS;

module.exports = {
	BetterLock,
};
