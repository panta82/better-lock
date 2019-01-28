const expect = require('chai').expect;

const { BetterLock } = require('../index');

describe('BetterLock', () => {
	it('can run a simple happy path', testDone => {
		const lock = new BetterLock();
		const startedAt = new Date();

		lock.acquire(waitWorker(250, 'a', 1, [new Error()]), (a1, a2, a3) => {
			expect(new Date() - startedAt).to.be.within(245, 300);
			expect(a1).to.equal('a');
			expect(a2).to.equal(1);
			expect(a3[0]).to.be.instanceOf(Error);
			testDone();
		});
	});

	it('will accept number as a name', testDone => {
		const lock = new BetterLock();

		let doneFirst = false;
		lock.acquire(15, waitWorker(20), () => {
			doneFirst = true;

			testDone();
		});

		lock.acquire('15', () => {
			expect(doneFirst).to.be.true;
		});
		lock.acquire(15, () => {
			expect(doneFirst).to.be.true;
		});
		lock.acquire(16, () => {
			expect(doneFirst).to.be.false;
		});
	});

	it('can run locks with different keys concurrently', testDone => {
		const lock = new BetterLock();
		const startedAt = new Date();
		let cbCount = 0;

		lock.acquire(undefined, waitWorker(250, 'a'), res => {
			expect(res).to.equal('a');
			cb();
		});

		lock.acquire('', waitWorker(250, 'b'), res => {
			expect(res).to.equal('b');
			cb();
		});

		lock.acquire('Proper key', waitWorker(250, 'c'), res => {
			expect(res).to.equal('c');
			cb();
		});

		lock.acquire('proper key', waitWorker(250, 'd'), res => {
			expect(res).to.equal('d');
			cb();
		});

		function cb() {
			cbCount++;
			if (cbCount < 4) {
				return;
			}

			expect(new Date() - startedAt).to.be.within(245, 300);
			testDone();
		}
	});

	it('can execute multiple jobs one after another', testDone => {
		const lock = new BetterLock({
			wait_timeout: 100,
			execution_timeout: 200, // should never trigger
			queue_size: 5,
		});

		let called1 = false;

		lock.acquire(waitWorker(50, null, 'ok1'), (err, res) => {
			expect(err).to.be.null;
			expect(res).to.equal('ok1');
			called1 = true;
		});

		lock.acquire(waitWorker(150, null, 'ok2'), (err, res) => {
			expect(err).to.be.null;
			expect(res).to.equal('ok2');
			expect(called1).to.be.true;
			testDone();
		});
	});

	it('will correctly tell caller if they can acquire lock', testDone => {
		const lock = new BetterLock({});

		expect(lock.canAcquire()).to.be.true;
		expect(lock.canAcquire('test')).to.be.true;

		lock.acquire(waitWorker(10), () => {});
		lock.acquire('test', waitWorker(30), () => {
			expect(lock.canAcquire()).to.be.true;
			expect(lock.canAcquire('test')).to.be.true;

			testDone();
		});

		expect(lock.canAcquire()).to.be.false;
		expect(lock.canAcquire('test')).to.be.false;
	});

	it('will log', testDone => {
		let seq = 0;
		const expected = [
			'[MyLock] Enqueued Job #10 [My test]',
			'[MyLock] Executing Job #10 [My test]',
			'[MyLock] Done called for Job #10 [My test]',
		];

		const lock = new BetterLock({
			name: 'MyLock',
			log,
		});

		BetterLock.LockJob._lastId = 9;
		lock.acquire('My test', waitWorker(100), () => {
			testDone();
		});

		function log(msg) {
			expect(msg).to.equal(expected[seq]);
			seq++;
		}
	});

	it('jobs will timeout after waiting in queue for too long', testDone => {
		const lock = new BetterLock({
			wait_timeout: 50,
			execution_timeout: 100, // should never trigger
		});

		let cbCount = 0;

		lock.acquire(waitWorker(75, null, 'ok1'), (err, res) => {
			expect(err).to.be.null;
			expect(res).to.equal('ok1');
			cbCount++;
		});

		lock.acquire(waitWorker(200000, null, 'ok2'), (err, res) => {
			expect(err).to.be.instanceOf(BetterLock.WaitTimeoutError);
			cbCount++;
		});

		setTimeout(() => {
			// Enqueue after some time, this one should run
			lock.acquire(waitWorker(50, null, 'ok3'), (err, res) => {
				expect(err).to.be.null;
				expect(res).to.equal('ok3');
				expect(cbCount).to.equal(2);
				testDone();
			});
		}, 50);
	});

	it('will timeout long running jobs', testDone => {
		const lock = new BetterLock({
			wait_timeout: 100, // should never trigger
			execution_timeout: 75,
			queue_size: 5,
		});

		let cbCount = 0;
		lock.acquire(waitWorker(100, 'wont', 'be', 'used'), err => {
			expect(err).to.be.instanceOf(BetterLock.ExecutionTimeoutError);
			cbCount++;
		});

		setTimeout(() => {
			lock.acquire(waitWorker(50, null, 'ok'), (err, res) => {
				expect(cbCount).to.equal(1);
				expect(err).to.be.null;
				expect(res).to.equal('ok');
				testDone();
			});
		}, 75);
	});

	describe('when overflowing', () => {
		it('it will kick out the most recently submitted job', testDone => {
			const lock = new BetterLock({
				wait_timeout: 200, // should never trigger
				execution_timeout: 300, // should never trigger
				queue_size: 2,
			});

			let cbCount = 0;
			lock.acquire(waitWorker(25, 1), arg => {
				// The executing one
				cbCount++;
				expect(cbCount).to.equal(2);
				expect(arg).to.equal(1);
			});
			lock.acquire(waitWorker(5, 2), arg => {
				cbCount++;
				expect(cbCount).to.equal(3);
				expect(arg).to.equal(2);
			});
			lock.acquire(waitWorker(5, 3), arg => {
				cbCount++;
				expect(cbCount).to.equal(4);
				expect(arg).to.equal(3);
				testDone();
			});
			lock.acquire(waitWorker(5, 4), err => {
				// This one will trigger the kicking out. And it will be the one kicked out
				cbCount++;
				expect(cbCount).to.equal(1);
				expect(err).to.be.instanceOf(BetterLock.QueueOverflowError);
			});
		});

		it('will handle queue size of 0', () => {
			const lock = new BetterLock({
				wait_timeout: 200, // should never trigger
				execution_timeout: 300, // should never trigger
				queue_size: 0,
			});

			return Promise.all([
				lock.acquire(waitWorker(25, null, 'result')),
				lock.acquire(waitWorker(5, null, 'never get here')).catch(err => err),
			]).then(([res1, res2]) => {
				expect(res1).to.equal('result');
				expect(res2).to.be.instanceOf(BetterLock.QueueOverflowError);
			});
		});
	});

	it('will extend stack traces', () => {
		return (function colorfulFunctionName() {
			const lock = new BetterLock({
				wait_timeout: 0,
				execution_timeout: 5,
				queue_size: 1,
			});

			return Promise.all([
				lock.acquire(waitWorker(25)).catch(err => err),
				lock.acquire(waitWorker(120)).catch(err => err),
				lock.acquire(waitWorker(120)).catch(err => err),
			]).then(([err1, err2, err3]) => {
				expect(err1).to.be.instanceOf(BetterLock.ExecutionTimeoutError);
				expect(err1.stack.indexOf('colorfulFunctionName')).to.be.gte(0);

				expect(err2).to.be.instanceOf(BetterLock.WaitTimeoutError);
				expect(err2.stack.indexOf('colorfulFunctionName')).to.be.gte(0);

				expect(err3).to.be.instanceOf(BetterLock.QueueOverflowError);
				expect(err3.stack.indexOf('colorfulFunctionName')).to.be.gte(0);
			});
		})();
	});

	describe('if used with promises', () => {
		it('will return a viable promise if called without callback', testDone => {
			const lock = new BetterLock();

			const variants = [];

			variants.push(
				lock.acquire(waitWorker(0, null, 'success')).then(res => {
					expect(res).to.equal('success');

					return lock.acquire(waitWorker(0, 'fail')).catch(err => {
						expect(err).to.equal('fail');
						return 1;
					});
				})
			);

			variants.push(
				lock.acquire('with key', waitWorker(0, null, 'success')).then(res => {
					expect(res).to.equal('success');

					return lock.acquire('with key', waitWorker(0, 'fail')).catch(err => {
						expect(err).to.equal('fail');
						return 2;
					});
				})
			);

			variants.push(
				lock.acquire('with key and options', waitWorker(0, null, 'success'), {}).then(res => {
					expect(res).to.equal('success');

					return lock.acquire('with key and options', waitWorker(0, 'fail')).catch(err => {
						expect(err).to.equal('fail');
						return 3;
					});
				})
			);

			variants.push(
				lock.acquire(/* just options */ waitWorker(0, null, 'success'), {}).then(res => {
					expect(res).to.equal('success');

					return lock.acquire(waitWorker(0, 'fail'), {}).catch(err => {
						expect(err).to.equal('fail');
						return 4;
					});
				})
			);

			Promise.all(variants)
				.then(results => {
					expect(results).to.eql([1, 2, 3, 4]);
					testDone();
				})
				.catch(testDone);
		});

		it('will allow executor to return a promise instead of calling done', testDone => {
			const lock = new BetterLock();

			lock.acquire(
				() => {
					return new Promise((resolve, reject) => {
						setTimeout(() => {
							resolve('result');
						}, 20);
					});
				},
				(err, res) => {
					expect(err).to.be.null;
					expect(res).to.equal('result');
				}
			);

			lock.acquire(
				() => {
					return new Promise((resolve, reject) => {
						setTimeout(() => {
							reject('error');
						}, 20);
					});
				},
				err => {
					expect(err).to.equal('error');

					testDone();
				}
			);
		});

		it('will allow executor to directly return a value or throw an error', testDone => {
			const lock = new BetterLock();

			lock.acquire(
				() => 'result',
				(err, res) => {
					expect(err).to.be.null;
					expect(res).to.equal('result');
				}
			);

			lock.acquire(
				() => {
					throw 'error';
				},
				err => {
					expect(err).to.equal('error');

					testDone();
				}
			);
		});
	});

	describe('when using in multi-lock mode', () => {
		it('can lock on multiple keys in a basic case', () => {
			const lock = new BetterLock();
			const startedAt = new Date();

			const sequence = [];
			return Promise.all([
				lock.acquire('a', waitWorker(50, null, 1)).then(res => sequence.push(res)),
				waitPromise(35).then(() =>
					lock.acquire('b', () => {
						sequence.push(2);
						return waitPromise(50, 2);
					})
				),
				waitPromise(15).then(() =>
					lock.acquire(['a', 'b'], () => {
						sequence.push(3);
						return waitPromise(50, 3);
					})
				),
			]).then(res => {
				expect(res).to.eql([1, 2, 3]);
				expect(sequence).to.eql([1, 3, 2]);
				expect(new Date() - startedAt).to.be.within(145, 180);
			});
		});

		it('can handle duplicate keys in the key list', () => {
			const lock = new BetterLock({});

			const startedAt = new Date();

			return Promise.all([
				lock.acquire(['a', undefined], waitWorker(50, null, '1')),
				waitPromise(5).then(() =>
					lock.acquire(['a', 'b', undefined, 'c', undefined, 'a'], waitWorker(50, null, '2'))
				),
				waitPromise(15).then(() => lock.acquire('c', waitWorker(50, null, '3'))),
			]).then(res => {
				expect(res).to.eql(['1', '2', '3']);
				expect(new Date() - startedAt).to.be.within(145, 180);
			});
		});

		it('can wait timeout on partially held locks', () => {
			const lock = new BetterLock({
				wait_timeout: 20,
				execution_timeout: 50,
			});

			const startedAt = new Date();

			return Promise.all([
				// Hold a, time out execution after 50ms
				lock.acquire('a', waitWorker(10000, null, 1)).catch(err => err),
				// Wait on a, grab b, then time out on a after 20ms
				lock
					.acquire(['a', 'b'], waitWorker(50, new Error('Should never be seen')))
					.catch(err => err),
				// Wait for b, grab it when #2 times out (20ms in).
				lock.acquire('b', waitWorker(30, null, 3), { wait_timeout: 30 }).catch(err => err),
			]).then(([res1, res2, res3]) => {
				expect(res1).to.be.instanceOf(BetterLock.ExecutionTimeoutError);
				expect(res2).to.be.instanceOf(BetterLock.WaitTimeoutError);
				expect(res3).to.equal(3);
				expect(new Date() - startedAt).to.be.within(45, 60);
			});
		});
	});
});

function waitWorker(ms, ...args) {
	return function(done) {
		setTimeout(() => {
			done.apply(null, args);
		}, ms);
	};
}

function waitPromise(ms, result) {
	return new Promise(resolve => {
		setTimeout(() => {
			resolve(result);
		}, ms);
	});
}
