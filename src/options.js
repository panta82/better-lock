module.exports = {
	/**
	 * Lock name. This will be written in all logs and error messages, to help you distinguish between different locks
	 * @type {string}
	 */
	name: '',
	
	/**
	 * Whether to log the internal actions. Set to true to use console.log. Alternatively, provide your own function
	 * @type {boolean|function}
	 */
	log: false
};