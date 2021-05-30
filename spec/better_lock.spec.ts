import BetterLock from '../src/index';
import { LockJob } from '../src/internals';

describe('BetterLock', () => {
  let baseDefaultOptions;
  beforeAll(() => {
    baseDefaultOptions = BetterLock.DEFAULT_OPTIONS;
  });

  beforeEach(() => {
    LockJob._lastId = 0;
    BetterLock.DEFAULT_OPTIONS = baseDefaultOptions;
  });

  it('can run a simple happy path', testDone => {
    const lock = new BetterLock();
    const startedAt = new Date();

    lock.acquire(waitCallback(250, 'a', 1, [new Error()]), (a1, a2, a3) => {
      expectMs(new Date().valueOf() - startedAt.valueOf(), 250);
      expect(a1).toEqual('a');
      expect(a2).toEqual(1);
      expect(a3[0]).toBeInstanceOf(Error);
      testDone();
    });
  });

  it('will accept number as a name', testDone => {
    const lock = new BetterLock();

    let doneFirst = false;
    lock.acquire(15, waitCallback(20), () => {
      doneFirst = true;

      testDone();
    });

    lock.acquire('15', () => {
      expect(doneFirst).toBeTruthy();
    });
    lock.acquire(15, () => {
      expect(doneFirst).toBeTruthy();
    });
    lock.acquire(16, () => {
      expect(doneFirst).toBeFalsy();
    });
  });

  it('can run locks with different keys concurrently', testDone => {
    const lock = new BetterLock();
    const startedAt = new Date();
    let cbCount = 0;

    lock.acquire(undefined, waitCallback(250, 'a'), res => {
      expect(res).toEqual('a');
      cb();
    });

    lock.acquire('', waitCallback(250, 'b'), res => {
      expect(res).toEqual('b');
      cb();
    });

    lock.acquire('Proper key', waitCallback(250, 'c'), res => {
      expect(res).toEqual('c');
      cb();
    });

    lock.acquire('proper key', waitCallback(250, 'd'), res => {
      expect(res).toEqual('d');
      cb();
    });

    function cb() {
      cbCount++;
      if (cbCount < 4) {
        return;
      }

      expectMs(new Date().valueOf() - startedAt.valueOf(), 250);
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

    lock.acquire(waitCallback(50, null, 'ok1'), (err, res) => {
      expect(err).toBeNull();
      expect(res).toEqual('ok1');
      called1 = true;
    });

    lock.acquire(waitCallback(150, null, 'ok2'), (err, res) => {
      expect(err).toBeNull();
      expect(res).toEqual('ok2');
      expect(called1).toBeTruthy();
      testDone();
    });
  });

  it('will correctly tell caller if they can acquire lock', testDone => {
    const lock = new BetterLock({});

    expect(lock.canAcquire()).toBeTruthy();
    expect(lock.canAcquire('test')).toBeTruthy();

    lock.acquire(waitCallback(10), () => {});
    lock.acquire('test', waitCallback(30), () => {
      expect(lock.canAcquire()).toBeTruthy();
      expect(lock.canAcquire('test')).toBeTruthy();

      testDone();
    });

    expect(lock.canAcquire()).toBeFalsy();
    expect(lock.canAcquire('test')).toBeFalsy();
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

    LockJob._lastId = 9;
    lock.acquire('My test', waitCallback(100), () => {
      testDone();
    });

    function log(msg) {
      expect(msg).toEqual(expected[seq]);
      seq++;
    }
  });

  it('can change default options', () => {
    BetterLock.DEFAULT_OPTIONS = {
      ...BetterLock.DEFAULT_OPTIONS,
      name: 'MyLock',
    };

    let seq = 0;
    const expected = [
      '[MyLock] Enqueued Job #10 [My test]',
      '[MyLock] Executing Job #10 [My test]',
      '[MyLock] Done called for Job #10 [My test]',
    ];

    const lock = new BetterLock({
      log,
    });

    LockJob._lastId = 9;

    return lock.acquire('My test', waitCallback(100));

    function log(msg) {
      expect(msg).toEqual(expected[seq]);
      seq++;
    }
  });

  it('will accept custom promise tester', () => {
    const lock = new BetterLock({
      promise_tester: p => p.isPromise === true,
    });

    let called = false;

    return Promise.all([
      lock.acquire(() => {
        return {
          then: resolve => {
            called = true;
            resolve(null);
          },
          isPromise: true,
        } as any as Promise<any>;
      }),
    ]).then(() => {
      expect(called).toBeTruthy();
    });
  });

  it('jobs will timeout after waiting in queue for too long', testDone => {
    const lock = new BetterLock({
      wait_timeout: 50,
      execution_timeout: 100, // should never trigger
    });

    let cbCount = 0;

    lock.acquire(waitCallback(75, null, 'ok1'), (err, res) => {
      expect(err).toBeNull();
      expect(res).toEqual('ok1');
      cbCount++;
    });

    lock.acquire(waitCallback(200000, null, 'ok2'), err => {
      expect(err).toBeInstanceOf(BetterLock.WaitTimeoutError);
      cbCount++;
    });

    setTimeout(() => {
      // Enqueue after some time, this one should run
      lock.acquire(waitCallback(50, null, 'ok3'), (err, res) => {
        expect(err).toBeNull();
        expect(res).toEqual('ok3');
        expect(cbCount).toEqual(2);
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
    lock.acquire(waitCallback(100, 'wont', 'be', 'used'), err => {
      expect(err).toBeInstanceOf(BetterLock.ExecutionTimeoutError);
      cbCount++;
    });

    setTimeout(() => {
      lock.acquire(waitCallback(50, null, 'ok'), (err, res) => {
        expect(cbCount).toEqual(1);
        expect(err).toBeNull();
        expect(res).toEqual('ok');
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
      lock.acquire(waitCallback(25, 1), arg => {
        // The executing one
        cbCount++;
        expect(cbCount).toEqual(2);
        expect(arg).toEqual(1);
      });
      lock.acquire(waitCallback(5, 2), arg => {
        cbCount++;
        expect(cbCount).toEqual(3);
        expect(arg).toEqual(2);
      });
      lock.acquire(waitCallback(5, 3), arg => {
        cbCount++;
        expect(cbCount).toEqual(4);
        expect(arg).toEqual(3);
        testDone();
      });
      lock.acquire(waitCallback(5, 4), err => {
        // This one will trigger the kicking out. And it will be the one kicked out
        cbCount++;
        expect(cbCount).toEqual(1);
        expect(err).toBeInstanceOf(BetterLock.QueueOverflowError);
      });
    });

    it('will handle queue size of 0', () => {
      const lock = new BetterLock({
        wait_timeout: 200, // should never trigger
        execution_timeout: 300, // should never trigger
        queue_size: 0,
      });

      return Promise.all([
        lock.acquire(waitCallback(25, null, 'result')),
        lock.acquire(waitCallback(5, null, 'never get here')).catch(err => err),
      ]).then(([res1, res2]) => {
        expect(res1).toEqual('result');
        expect(res2).toBeInstanceOf(BetterLock.QueueOverflowError);
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
        lock.acquire(waitCallback(25)).catch(err => err),
        lock.acquire(waitCallback(120)).catch(err => err),
        lock.acquire(waitCallback(120)).catch(err => err),
      ]).then(([err1, err2, err3]) => {
        expect(err1).toBeInstanceOf(BetterLock.ExecutionTimeoutError);
        expect(err1.stack.indexOf('colorfulFunctionName')).toBeGreaterThanOrEqual(0);

        expect(err2).toBeInstanceOf(BetterLock.WaitTimeoutError);
        expect(err2.stack.indexOf('colorfulFunctionName')).toBeGreaterThanOrEqual(0);

        expect(err3).toBeInstanceOf(BetterLock.QueueOverflowError);
        expect(err3.stack.indexOf('colorfulFunctionName')).toBeGreaterThanOrEqual(0);
      });
    })();
  });

  it('can abort specific key', done => {
    const lock = new BetterLock();

    let noCallCount = 0;
    const noCall = () => {
      noCallCount++;
    };

    let result1 = undefined;
    lock.acquire(waitCallback(25, null, 'a')).then(res => {
      result1 = res;
    }, noCall);

    setTimeout(() => {
      lock.acquire(noCall).then(noCall, err => {
        expect(err).toBeInstanceOf(BetterLock.JobAbortedError);
      });
    }, 5);

    setTimeout(() => {
      lock.abort();
    }, 10);

    setTimeout(() => {
      expect(noCallCount).toEqual(0);
      expect(result1).toEqual('a');

      done();
    }, 40);
  });

  it('can abort all', () => {
    const lock = new BetterLock();

    let noCallCount = 0;
    const noCall = () => {
      noCallCount++;
    };

    let cbCount = 0;
    const callback = err => {
      cbCount++;
      expect(err).toBeInstanceOf(BetterLock.JobAbortedError);
    };

    lock.acquire(noCall, callback);
    lock.acquire('a', noCall, callback);
    lock.acquire('b', noCall, callback);

    lock.abortAll();

    expect(lock.canAcquire()).toBeTruthy();
    expect(lock.canAcquire('a')).toBeTruthy();
    expect(lock.canAcquire('b')).toBeTruthy();
    expect(noCallCount).toEqual(0);
    expect(cbCount).toEqual(3);
  });

  describe('if used with promises', () => {
    it('will return a viable promise if called without callback', testDone => {
      const lock = new BetterLock();

      const variants = [];

      variants.push(
        lock.acquire(waitCallback(0, null, 'success')).then(res => {
          expect(res).toEqual('success');

          return lock.acquire(waitCallback(0, 'fail')).catch(err => {
            expect(err).toEqual('fail');
            return 1;
          });
        })
      );

      variants.push(
        lock.acquire('with key', waitCallback(0, null, 'success')).then(res => {
          expect(res).toEqual('success');

          return lock.acquire('with key', waitCallback(0, 'fail')).catch(err => {
            expect(err).toEqual('fail');
            return 2;
          });
        })
      );

      variants.push(
        lock.acquire('with key and options', waitCallback(0, null, 'success'), {}).then(res => {
          expect(res).toEqual('success');

          return lock.acquire('with key and options', waitCallback(0, 'fail')).catch(err => {
            expect(err).toEqual('fail');
            return 3;
          });
        })
      );

      variants.push(
        lock.acquire(/* just options */ waitCallback(0, null, 'success'), {}).then(res => {
          expect(res).toEqual('success');

          return lock.acquire(waitCallback(0, 'fail'), {}).catch(err => {
            expect(err).toEqual('fail');
            return 4;
          });
        })
      );

      Promise.all(variants)
        .then(results => {
          expect(results).toEqual([1, 2, 3, 4]);
          testDone();
        })
        .catch(testDone);
    });

    it('will allow executor to return a promise instead of calling done', testDone => {
      const lock = new BetterLock();

      lock.acquire(
        () => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve('result');
            }, 20);
          });
        },
        (err, res) => {
          expect(err).toBeNull();
          expect(res).toEqual('result');
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
          expect(err).toEqual('error');

          testDone();
        }
      );
    });

    it('will allow executor to directly return a value or throw an error', testDone => {
      const lock = new BetterLock();

      lock.acquire(
        () => 'result',
        (err, res) => {
          expect(err).toBeNull();
          expect(res).toEqual('result');
        }
      );

      lock.acquire(
        () => {
          throw 'error';
        },
        err => {
          expect(err).toEqual('error');

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
        lock.acquire('a', waitCallback(50, null, 1)).then(res => sequence.push(res)),
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
        expect(res).toEqual([1, 2, 3]);
        expect(sequence).toEqual([1, 3, 2]);
        expectMs(new Date().valueOf() - startedAt.valueOf(), 150);
      });
    });

    it('can handle duplicate keys in the key list', () => {
      const lock = new BetterLock({});

      const startedAt = new Date();

      return Promise.all([
        lock.acquire(['a', undefined], waitCallback(50, null, '1')),
        waitPromise(5).then(() =>
          lock.acquire(['a', 'b', undefined, 'c', undefined, 'a'], waitCallback(50, null, '2'))
        ),
        waitPromise(15).then(() => lock.acquire('c', waitCallback(50, null, '3'))),
      ]).then(res => {
        expect(res).toEqual(['1', '2', '3']);
        expectMs(new Date().valueOf() - startedAt.valueOf(), 150);
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
        lock.acquire('a', waitCallback(10000, null, 1)).catch(err => err),
        // Wait on a, grab b, then time out on a after 20ms
        lock
          .acquire(['a', 'b'], waitCallback(50, new Error('Should never be seen')))
          .catch(err => err),
        // Wait for b, grab it when #2 times out (20ms in).
        lock.acquire('b', waitCallback(30, null, 3), { wait_timeout: 30 }).catch(err => err),
      ]).then(([res1, res2, res3]) => {
        expect(res1).toBeInstanceOf(BetterLock.ExecutionTimeoutError);
        expect(res2).toBeInstanceOf(BetterLock.WaitTimeoutError);
        expect(res3).toEqual(3);
        expectMs(new Date().valueOf() - startedAt.valueOf(), 50);
      });
    });

    it('will gracefully handle empty key lists', () => {
      const lock = new BetterLock({
        wait_timeout: 1000,
        execution_timeout: 1000,
      });

      const startedAt = new Date();
      let executed = false;
      return lock
        .acquire([], () => {
          // Should have been executed immediately
          expectMs(new Date().valueOf() - startedAt.valueOf(), 0);
          executed = true;
        })
        .finally(() => {
          expect(executed).toBeTruthy();
        });
    });
  });
});

function waitCallback(ms: number, ...args): (done: (...args: any) => void) => void {
  return function (done) {
    setTimeout(() => {
      done(...args);
    }, ms);
  };
}

function waitPromise(ms, result?) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(result);
    }, ms);
  });
}

function expectMs(actual, expected, lowerBound = 5, upperBound = 50) {
  expect(actual).toBeGreaterThanOrEqual(expected - lowerBound);
  expect(actual).toBeLessThan(expected + upperBound);
}
