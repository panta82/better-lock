const tools = require('./tools');

const DEFAULT_OPTIONS = require('./default_options');
const LockJob = require('./lock_job');
const {BetterLockInternalError, InvalidArgumentError, WaitTimeoutError, ExecutionTimeoutError} = require('./errors');

const OPTION_ALIASES = {
	wait_timeout: 'waitTimeout',
	execution_timeout: 'executionTimeout',
};

function BetterLock(options = DEFAULT_OPTIONS) {
	options = Object.assign({}, DEFAULT_OPTIONS, options);
	
	const log = makeLog(options.name, options.log);
	
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
	 * @param {function} callback Function to be called after the executor finishes or if we never enter the lock (timeout, queue depletion).
	 * @param {object} [customOptions] Option overrides to be applied on this job only
	 */
	function acquire(key, executor, callback, customOptions = null) {
		if (arguments.length < 3) {
			callback = executor;
			executor = key;
			key = undefined;
		}
		
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
		job.wait_timeout = getOption('wait_timeout', customOptions);
		job.execution_timeout = getOption('execution_timeout', customOptions);
		queue.push(job);
		
		log(`Enqueued ${job}`);
		
		setImmediate(update);
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
	
	function forEachQueue(fn) {
		fn(undefined, _noKeyQueue);
		for (let key in _keyQueues) {
			fn(key, _keyQueues[key]);
		}
	}
	
	/**
	 * @param {string} key
	 * @param {LockJob[]} queue
	 */
	function update(key, queue) {
		if (!key && !queue) {
			return forEachQueue(update);
		}
		
		const queueLength = queue.length;
		for (let i = 0; i < queueLength; i++) {
			const job = queue[i];
			
			if (i === 0 && !job.executed_at) {
				// The first job in queue is not being executed. So we can execute it now.
				executeJob(job);
			}
			
			if (!job.executed_at && tools.isNumber(job.wait_timeout) && !job.wait_timeout_ptr) {
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
		
		job.executor(lockDone);
		
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
		
		clearTimeout(job.execution_timeout_ptr);
		job.execution_timeout_ptr = null;
		
		const queue = getQueue(job.key);
		if (!queue) {
			throw new BetterLockInternalError(options.name, `Couldn't find queue for key "${job.key}"`);
		}
		
		const index = queue.indexOf(job);
		if (index < 0) {
			throw new BetterLockInternalError(options.name, `Couldn't locate job ${job} inside its queue ("${job.key}")`);
		}
		
		job.ended_at = new Date();
		queue.splice(index, 1);
		
		job.callback.apply(null, callbackArgs);
		
		setImmediate(update);
	}
}

function makeLog(name, doLog) {
	if (!doLog) {
		return tools.noop;
	}
	
	if (doLog === true) {
		doLog = console.log.bind(console);
	}
	
	if (name) {
		name = '[' + name + '] ';
	}
	
	return function log(msg) {
		if (name) {
			doLog(name + msg);
		} else {
			doLog(msg);
		}
	};
}

module.exports = {
	BetterLock
};