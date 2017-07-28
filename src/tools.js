function isString(ob) {
	return typeof ob === 'string';
}

function isFunction(ob) {
	return typeof ob === 'function';
}

function noop() {}

module.exports = {
	isString,
	isFunction,
	noop
};