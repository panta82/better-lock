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

module.exports = {
	isString,
	isFunction,
	isNumber,
	noop
};