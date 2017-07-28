let _lastId = 0;

class LockJob {
	constructor(key, executor, callback) {
		_lastId++;
		this.id = _lastId;
		this.key = key;
		this.executor = executor;
		this.callback = callback;
		this.created_at = new Date();
		this.executed_at = null;
		this.completed_at = null;
	}
	
	toString() {
		return this.key
			? `Job "${this.key}" (#${this.id})`
			: `Job #${this.id}`;
	}
}

module.exports = LockJob;