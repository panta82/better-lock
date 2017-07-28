class LockJob {
	constructor(key, executor, callback) {
		LockJob._lastId++;
		this.id = LockJob._lastId;
		this.key = key;
		this.executor = executor;
		this.callback = callback;
		this.enqueued_at = new Date();
		this.executed_at = null;
		this.ended_at = null;
		
		this.wait_timeout = undefined;
		this.wait_timeout_ptr = null;
		this.execution_timeout = undefined;
		this.execution_timeout_ptr = null;
	}
	
	toString() {
		return this.key
			? `Job "${this.key}" (#${this.id})`
			: `Job #${this.id}`;
	}
}

LockJob._lastId = 0;

module.exports = LockJob;
