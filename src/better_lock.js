const tools = require('./tools');

const DEFAULT_OPTIONS = require('./options');
const LockJob = require('./lock_job');
const {BetterLockInternalError, InvalidArgumentError} = require('./errors');

function BetterLock(options = DEFAULT_OPTIONS) {
	options = Object.assign({}, DEFAULT_OPTIONS, options);
	
	const log = makeLog(options.name, options.log);
	
	const _noKeyQueue = [];
	const _keyQueues = {};
	
	Object.assign(this, /** @lends {BetterLock.prototype} */ {
		acquire
	});
	
	/**
	 * Acquire lock. Once the lock is acquired, we will call the executor function, with a done() method.
	 * You must call "done" to release the lock. If acquire fails, callback will be called with appropriate error.
	 * Callback will also be called with whatever exit arguments you pass to done, so you can do all your cleanup
	 * code there.
	 * @param {string} [key] Named key for this particular call. Calls with different keys will be run in parallel. Not mandatory.
	 * @param {function} executor Function that will run inside the lock
	 * @param {function} callback Function to be called after the executor finishes or if we never enter the lock (timeout, queue depletion).
	 */
	function acquire(key, executor, callback) {
		log('enter', key);
		
		if (arguments.length < 3) {
			callback = executor;
			executor = key;
			key = undefined;
		}
		
		if (!tools.isFunction(executor)) {
			throw new InvalidArgumentError('executor', 'a function', executor);
		}
		if (!tools.isFunction(callback)) {
			throw new InvalidArgumentError('callback', 'a function', callback);
		}
		
		const queue = key
			? _keyQueues[key] || (_keyQueues[key] = [])
			: _noKeyQueue;
		
		queue.push(new LockJob(key, executor, callback));
		setImmediate(update);
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
		
		if (!queue[0].executed_at) {
			// First item is not being executed. So we can execute it now
			executeJob(queue[0]);
		}
	}
	
	/**
	 * @param {LockJob} job
	 */
	function executeJob(job) {
		log(`Executing ${job}`);
		job.executed_at = new Date();
		job.executor(lockDone);
		
		function lockDone() {
			log(`Done called for ${job}`);
			
			const queue = getQueue(job.key);
			if (!queue) {
				throw new BetterLockInternalError(`Couldn't find queue for key "${job.key}"`);
			}
			
			const index = queue.indexOf(job);
			if (index < 0) {
				throw new BetterLockInternalError(`Couldn't locate job ${job} inside its queue ("${job.key}")`);
			}
			
			queue.splice(index, 1);
			onJobDone(job, arguments);
			
			setImmediate(update);
		}
	}
	
	/**
	 * @param {LockJob} job
	 * @param {*[]|arguments} args
	 */
	function onJobDone(job, args) {
		job.callback.apply(null, args);
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
		name = '[' + name + ']';
	}
	
	return function log() {
		const args = Array.prototype.slice.call(arguments);
		if (name) {
			args.unshift(name);
		}
		doLog.apply(null, args);
	};
}

module.exports = {
	BetterLock
};