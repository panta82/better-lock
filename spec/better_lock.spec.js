const expect = require('chai').expect;

const BetterLock = require('../index');

describe('BetterLock', () => {
	describe('acquire', () => {
		it('can run a basic happy path', (testDone) => {
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
				'[MyLock] Acquire "My test"',
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
	});
});

function waitArgs(wait, ...args) {
	return function (done) {
		setTimeout(() => {
			done.apply(null, args);
		}, wait);
	};
}