/**
 * Class that represents one scheduled job and its state. This is created every time user calls "acquire"
 */
class LockJob {
	constructor(keys, executor, callback, options) {
		LockJob._lastId++;

		/** ID to uniquely identify this particular job */
		this.id = LockJob._lastId;

		/**
		 * List of keys that will be locked. Always an array
		 * @type {Array}
		 */
		this.keys = keys;

		/**
		 * Number of keys which this job is waiting on. Once this reaches 0, job will be executed
		 */
		this.waiting_count = keys.length;

		/**
		 * Function that will be called inside the lock
		 */
		this.executor = executor;

		/**
		 * Function that will be called once job is done, whether it succeeds or times out
		 */
		this.callback = callback;

		/**
		 * Timestamp when job was created
		 */
		this.enqueued_at = new Date();

		/**
		 * Timestamp when job was executed
		 */
		this.executed_at = null;

		/**
		 * This is set when job ends, in case something holds a reference to it
		 */
		this.ended_at = null;

		/**
		 * Options that apply to this particular job
		 * @type {LockJobOptions}
		 */
		this.options = options;

		/**
		 * Id of the wait timer
		 */
		this.wait_timeout_id = null;

		/**
		 * Id of the execution timer
		 */
		this.execution_timeout_id = null;

		/**
		 * Saved incoming stack, for the purpose of extending stack traces
		 */
		this.incoming_stack = null;
	}

	toString() {
		return `Job #${this.id} [${this.keys.join(', ')}]`;
	}
}

LockJob._lastId = 0;

// *********************************************************************************************************************

/**
 * Class to hold pending, holding and executing jobs for one key
 */
class KeyQueue {
	constructor(key) {
		this.key = key;

		/**
		 * Queue of jobs waiting to be executed.
		 * Jobs in this state are governed by the wait_timeout.
		 * @type {LockJob[]}
		 */
		this.jobs = [];

		/**
		 * Active job that is holding this key. This job could be waiting on other keys or executing.
		 * @type {LockJob}
		 */
		this.active = null;
	}

	toString() {
		return this.key === KeyQueue.DEFAULT_QUEUE_KEY ? 'JobQueue' : `JobQueue<${this.key}>`;
	}
}

// We will use this key when user doesn't supply anything
KeyQueue.DEFAULT_QUEUE_KEY = '___DEFAULT_QUEUE_KEY___';

module.exports = {
	LockJob,
	KeyQueue,
};
