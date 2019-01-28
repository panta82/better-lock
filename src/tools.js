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

function isArray(val) {
	return Array.isArray(val);
}

function isObject(val) {
	return typeof val === 'object' && val !== null;
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

/**
 * Assign properties from sources to target, skipping over undefined-s
 * @param target Target object which will be mutated
 * @param {object|Array} sources One or more source objects which will provide properties
 * @param {object} aliases Lookup mapping aliased properties from sources to properties on target
 */
function assign(target, sources, aliases) {
	if (!isArray(sources)) {
		sources = [sources];
	}

	for (const source of sources) {
		if (!isObject(source)) {
			// We must have an object to assign
			continue;
		}

		for (const key in source) {
			if (!source.hasOwnProperty(key)) {
				continue;
			}

			const sourceValue = source[key];
			if (sourceValue === undefined) {
				// Do not overwrite undefineds
				continue;
			}

			const targetKey = (aliases && aliases[key]) || key;
			const targetValue = target[targetKey];

			if (isObject(sourceValue) && isObject(targetValue)) {
				// Merge deep.
				const cloneRoot = targetValue.constructor ? new targetValue.constructor() : {};
				target[targetKey] = assign(cloneRoot, targetValue, sourceValue);
				continue;
			}

			// In all other cases, copy by reference
			target[targetKey] = sourceValue;
		}
	}

	return target;
}

module.exports = {
	isString,
	isFunction,
	isNumber,
	isArray,
	isObject,
	noop,
	makeLog,
	callbackWithPromise,
	assign,
};
