class LockJob {
	constructor(key, executor, callback) {
		LockJob._lastId++;
		this.id = LockJob._lastId;
		this.key = key;
		this.executor = executor;
		this.callback = callback;
		this.enqueued_at = new Date();
		this.wait_timeout = null;
		this.executed_at = null;
		this.execution_timeout = null;
	}
	
	toString() {
		return this.key
			? `Job "${this.key}" (#${this.id})`
			: `Job #${this.id}`;
	}
}

LockJob._lastId = 0;

module.exports = LockJob;
