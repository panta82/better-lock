function isString(val) {
	return typeof val === 'string';
}

function isFunction(val) {
	return typeof val === 'function';
}

function isNumber(val, includeInfinity = false, includeNaN = false) {
	if (typeof val !== 'number') {
		return false;
	}
	if (!includeInfinity && (val === Number.POSITIVE_INFINITY || val === Number.NEGATIVE_INFINITY)) {
		return false;
	}
	if (!includeNaN && isNaN(val)) {
		return false;
	}
	return true;
}

function noop() {}

function makeLog(name, doLog) {
	if (!doLog) {
		return noop;
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

function callbackWithPromise() {
	let callback;
	const promise = new Promise((resolve, reject) => {
		callback = (err, result) => {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		};
	});
	callback.promise = promise;
	return callback;
}

module.exports = {
	isString,
	isFunction,
	isNumber,
	noop,
	makeLog,
	callbackWithPromise
};