const expect = require('chai').expect;

const BetterLock = require('../index');

describe('BetterLock', () => {

	it('can run a simple happy path', (testDone) => {
		const lock = new BetterLock();
		const startedAt = new Date();
		
		lock.acquire(waitArgs(250, 'a', 1, [new Error()]), (a1, a2, a3) => {
			expect(new Date() - startedAt).to.be.within(245, 300);
			expect(a1).to.equal('a');
			expect(a2).to.equal(1);
			expect(a3[0]).to.be.instanceOf(Error);
			testDone();
		});
	});
	
	it('can run locks with different keys concurrently', (testDone) => {
		const lock = new BetterLock();
		const startedAt = new Date();
		let cbCount = 0;
		
		lock.acquire(undefined, waitArgs(250, 'a'), (res) => {
			expect(res).to.equal('a');
			cb();
		});
		
		lock.acquire('', waitArgs(250, 'b'), (res) => {
			expect(res).to.equal('b');
			cb();
		});
		
		lock.acquire('Proper key', waitArgs(250, 'c'), (res) => {
			expect(res).to.equal('c');
			cb();
		});
		
		lock.acquire('proper key', waitArgs(250, 'd'), (res) => {
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
	
	it('will log', (testDone) => {
		let seq = 0;
		const expected = [
			'[MyLock] Enqueued Job "My test" (#10)',
			'[MyLock] Executing Job "My test" (#10)',
			'[MyLock] Done called for Job "My test" (#10)',
		];
		
		const lock = new BetterLock({
			name: 'MyLock',
			log
		});
		
		BetterLock.LockJob._lastId = 9;
		lock.acquire('My test', waitArgs(100), () => {
			testDone();
		});
		
		function log(msg) {
			expect(msg).to.equal(expected[seq]);
			seq++;
		}
	});

	it('can execute multiple jobs one after another', (testDone) => {
		const lock = new BetterLock({
			wait_timeout: 100,
			execution_timeout: 200, // should never trigger
			queue_size: 5
		});
		
		let called1 = false;
		
		lock.acquire(waitArgs(50, null, 'ok1'), (err, res) => {
			expect(err).to.be.null;
			expect(res).to.equal('ok1');
			called1 = true;
		});
		
		lock.acquire(waitArgs(150, null, 'ok2'), (err, res) => {
			expect(err).to.be.null;
			expect(res).to.equal('ok2');
			expect(called1).to.be.true;
			testDone();
		});
	});
	
	it('jobs will timeout after waiting in queue for too long', (testDone) => {
		const lock = new BetterLock({
			wait_timeout: 50,
			execution_timeout: 100 // should never trigger
		});
		
		let cbCount = 0;
		
		lock.acquire(waitArgs(75, null, 'ok1'), (err, res) => {
			expect(err).to.be.null;
			expect(res).to.equal('ok1');
			cbCount++;
		});
		
		lock.acquire(waitArgs(200000, null, 'ok2'), (err, res) => {
			expect(err).to.be.instanceOf(BetterLock.WaitTimeoutError);
			cbCount++;
		});
		
		setTimeout(() => {
			// Enqueue after some time, this one should run
			lock.acquire(waitArgs(50, null, 'ok3'), (err, res) => {
				expect(err).to.be.null;
				expect(res).to.equal('ok3');
				expect(cbCount).to.equal(2);
				testDone();
			});
		}, 50);
	});
	
	it('will timeout long running jobs', (testDone) => {
		const lock = new BetterLock({
			wait_timeout: 100, // should never trigger
			execution_timeout: 75,
			queue_size: 5
		});
		
		let cbCount = 0;
		lock.acquire(waitArgs(100, 'wont', 'be', 'used'), (err) => {
			expect(err).to.be.instanceOf(BetterLock.ExecutionTimeoutError);
			cbCount++;
		});
		
		setTimeout(() => {
			lock.acquire(waitArgs(50, null, 'ok'), (err, res) => {
				expect(cbCount).to.equal(1);
				expect(err).to.be.null;
				expect(res).to.equal('ok');
				testDone();
			});
		}, 75)
	});
	
	describe('when overflowing', () => {
		it('will kick out the right job using the "kick_first" strategy', (testDone) => {
			const lock = new BetterLock({
				wait_timeout: 200, // should never trigger
				execution_timeout: 300, // should never trigger
				queue_size: 2,
				overflow_strategy: BetterLock.OVERFLOW_STRATEGIES.kick_first
			});
			
			let cbCount = 0;
			lock.acquire(waitArgs(25, 1), (arg) => {
				// The executing one
				cbCount++;
				expect(cbCount).to.equal(2);
				expect(arg).to.equal(1);
			});
			lock.acquire(waitArgs(5, 2), (err) => {
				// First in queue. The one to be kicked out
				cbCount++;
				expect(cbCount).to.equal(1);
				expect(err).to.be.instanceOf(BetterLock.QueueOverflowError);
			});
			lock.acquire(waitArgs(5, 3), (arg) => {
				cbCount++;
				expect(cbCount).to.equal(3);
				expect(arg).to.equal(3);
			});
			lock.acquire(waitArgs(5, 4), (arg) => {
				// This one will trigger the kicking out
				cbCount++;
				expect(cbCount).to.equal(4);
				expect(arg).to.equal(4);
				testDone();
			});
		});
		
		it('will kick out the right job using the "kick_last" strategy', (testDone) => {
			const lock = new BetterLock({
				wait_timeout: 200, // should never trigger
				execution_timeout: 300, // should never trigger
				queue_size: 2,
				overflow_strategy: BetterLock.OVERFLOW_STRATEGIES.kick_last
			});
			
			let cbCount = 0;
			lock.acquire(waitArgs(25, 1), (arg) => {
				// The executing one
				cbCount++;
				expect(cbCount).to.equal(2);
				expect(arg).to.equal(1);
			});
			lock.acquire(waitArgs(5, 2), (arg) => {
				cbCount++;
				expect(cbCount).to.equal(3);
				expect(arg).to.equal(2);
				
			});
			lock.acquire(waitArgs(5, 3), (err) => {
				// The last in queue before adding the overflow job. The one to be kicked out
				cbCount++;
				expect(cbCount).to.equal(1);
				expect(err).to.be.instanceOf(BetterLock.QueueOverflowError);
			});
			lock.acquire(waitArgs(5, 4), (arg) => {
				// This one will trigger the kicking out
				cbCount++;
				expect(cbCount).to.equal(4);
				expect(arg).to.equal(4);
				testDone();
			});
		});
		
		it('will kick out the right job using the "reject" strategy', (testDone) => {
			const lock = new BetterLock({
				wait_timeout: 200, // should never trigger
				execution_timeout: 300, // should never trigger
				queue_size: 2,
				overflow_strategy: BetterLock.OVERFLOW_STRATEGIES.reject
			});
			
			let cbCount = 0;
			lock.acquire(waitArgs(25, 1), (arg) => {
				// The executing one
				cbCount++;
				expect(cbCount).to.equal(2);
				expect(arg).to.equal(1);
			});
			lock.acquire(waitArgs(5, 2), (arg) => {
				cbCount++;
				expect(cbCount).to.equal(3);
				expect(arg).to.equal(2);
				
			});
			lock.acquire(waitArgs(5, 3), (arg) => {
				cbCount++;
				expect(cbCount).to.equal(4);
				expect(arg).to.equal(3);
				testDone();
			});
			lock.acquire(waitArgs(5, 4), (err) => {
				// This one will trigger the kicking out. And it will be the one kicked out
				cbCount++;
				expect(cbCount).to.equal(1);
				expect(err).to.be.instanceOf(BetterLock.QueueOverflowError);
			});
		});
	});
	
});

function waitArgs(wait, ...args) {
	return function (done) {
		setTimeout(() => {
			done.apply(null, args);
		}, wait);
	};
}