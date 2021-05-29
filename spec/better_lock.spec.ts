import BetterLock from '../src/index';

describe('BetterLock', () => {
  it('can run a simple happy path', testDone => {
    const lock = new BetterLock();
    const startedAt = new Date();

    lock.acquire(waitWorker(250, 'a', 1, [new Error()]), (a1, a2, a3) => {
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
    lock.acquire(15, waitWorker(20), () => {
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

    lock.acquire(undefined, waitWorker(250, 'a'), res => {
      expect(res).toEqual('a');
      cb();
    });

    lock.acquire('', waitWorker(250, 'b'), res => {
      expect(res).toEqual('b');
      cb();
    });

    lock.acquire('Proper key', waitWorker(250, 'c'), res => {
      expect(res).toEqual('c');
      cb();
    });

    lock.acquire('proper key', waitWorker(250, 'd'), res => {
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

    lock.acquire(waitWorker(50, null, 'ok1'), (err, res) => {
      expect(err).toBeNull();
      expect(res).toEqual('ok1');
      called1 = true;
    });

    lock.acquire(waitWorker(150, null, 'ok2'), (err, res) => {
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

    lock.acquire(waitWorker(10), () => {});
    lock.acquire('test', waitWorker(30), () => {
      expect(lock.canAcquire()).toBeTruthy();
      expect(lock.canAcquire('test')).toBeTruthy();

      testDone();
    });

    expect(lock.canAcquire()).toBeFalsy();
    expect(lock.canAcquire('test')).toBeFalsy();
  });

  // it('will log', testDone => {
  //   let seq = 0;
  //   const expected = [
  //     '[MyLock] Enqueued Job #10 [My test]',
  //     '[MyLock] Executing Job #10 [My test]',
  //     '[MyLock] Done called for Job #10 [My test]',
  //   ];
  //
  //   const lock = new BetterLock({
  //     name: 'MyLock',
  //     log,
  //   });
  //
  //   BetterLock.LockJob._lastId = 9;
  //   lock.acquire('My test', waitWorker(100), () => {
  //     testDone();
  //   });
  //
  //   function log(msg) {
  //     expect(msg).toEqual(expected[seq]);
  //     seq++;
  //   }
  // });
  //
  // it('can change default options', () => {
  //   const defaultOptions = BetterLock.DEFAULT_OPTIONS;
  //   BetterLock.DEFAULT_OPTIONS = new BetterLock.Options({
  //     name: 'MyLock',
  //   });
  //
  //   let seq = 0;
  //   const expected = [
  //     '[MyLock] Enqueued Job #10 [My test]',
  //     '[MyLock] Executing Job #10 [My test]',
  //     '[MyLock] Done called for Job #10 [My test]',
  //   ];
  //
  //   const lock = new BetterLock({
  //     log,
  //   });
  //
  //   BetterLock.LockJob._lastId = 9;
  //
  //   return lock.acquire('My test', waitWorker(100)).then(
  //     () => {
  //       BetterLock.DEFAULT_OPTIONS = defaultOptions;
  //     },
  //     () => {
  //       BetterLock.DEFAULT_OPTIONS = defaultOptions;
  //     }
  //   );
  //
  //   function log(msg) {
  //     expect(msg).toEqual(expected[seq]);
  //     seq++;
  //   }
  // });
  //
  // it('will accept custom promise tester', () => {
  //   const lock = new BetterLock({
  //     promise_tester: p => p.isPromise === true,
  //   });
  //
  //   let called = false;
  //
  //   return Promise.all([
  //     lock.acquire(() => {
  //       return {
  //         then: resolve => {
  //           called = true;
  //           resolve();
  //         },
  //         isPromise: true,
  //       };
  //     }),
  //   ]).then(() => {
  //     expect(called).toBeTruthy();
  //   });
  // });
  //
  // it('jobs will timeout after waiting in queue for too long', testDone => {
  //   const lock = new BetterLock({
  //     wait_timeout: 50,
  //     execution_timeout: 100, // should never trigger
  //   });
  //
  //   let cbCount = 0;
  //
  //   lock.acquire(waitWorker(75, null, 'ok1'), (err, res) => {
  //     expect(err).toBeNull();
  //     expect(res).toEqual('ok1');
  //     cbCount++;
  //   });
  //
  //   lock.acquire(waitWorker(200000, null, 'ok2'), (err, res) => {
  //     expect(err).to.be.instanceOf(BetterLock.WaitTimeoutError);
  //     cbCount++;
  //   });
  //
  //   setTimeout(() => {
  //     // Enqueue after some time, this one should run
  //     lock.acquire(waitWorker(50, null, 'ok3'), (err, res) => {
  //       expect(err).toBeNull();
  //       expect(res).toEqual('ok3');
  //       expect(cbCount).toEqual(2);
  //       testDone();
  //     });
  //   }, 50);
  // });
  //
  // it('will timeout long running jobs', testDone => {
  //   const lock = new BetterLock({
  //     wait_timeout: 100, // should never trigger
  //     execution_timeout: 75,
  //     queue_size: 5,
  //   });
  //
  //   let cbCount = 0;
  //   lock.acquire(waitWorker(100, 'wont', 'be', 'used'), err => {
  //     expect(err).to.be.instanceOf(BetterLock.ExecutionTimeoutError);
  //     cbCount++;
  //   });
  //
  //   setTimeout(() => {
  //     lock.acquire(waitWorker(50, null, 'ok'), (err, res) => {
  //       expect(cbCount).toEqual(1);
  //       expect(err).toBeNull();
  //       expect(res).toEqual('ok');
  //       testDone();
  //     });
  //   }, 75);
  // });
  //
  // describe('when overflowing', () => {
  //   it('it will kick out the most recently submitted job', testDone => {
  //     const lock = new BetterLock({
  //       wait_timeout: 200, // should never trigger
  //       execution_timeout: 300, // should never trigger
  //       queue_size: 2,
  //     });
  //
  //     let cbCount = 0;
  //     lock.acquire(waitWorker(25, 1), arg => {
  //       // The executing one
  //       cbCount++;
  //       expect(cbCount).toEqual(2);
  //       expect(arg).toEqual(1);
  //     });
  //     lock.acquire(waitWorker(5, 2), arg => {
  //       cbCount++;
  //       expect(cbCount).toEqual(3);
  //       expect(arg).toEqual(2);
  //     });
  //     lock.acquire(waitWorker(5, 3), arg => {
  //       cbCount++;
  //       expect(cbCount).toEqual(4);
  //       expect(arg).toEqual(3);
  //       testDone();
  //     });
  //     lock.acquire(waitWorker(5, 4), err => {
  //       // This one will trigger the kicking out. And it will be the one kicked out
  //       cbCount++;
  //       expect(cbCount).toEqual(1);
  //       expect(err).to.be.instanceOf(BetterLock.QueueOverflowError);
  //     });
  //   });
  //
  //   it('will handle queue size of 0', () => {
  //     const lock = new BetterLock({
  //       wait_timeout: 200, // should never trigger
  //       execution_timeout: 300, // should never trigger
  //       queue_size: 0,
  //     });
  //
  //     return Promise.all([
  //       lock.acquire(waitWorker(25, null, 'result')),
  //       lock.acquire(waitWorker(5, null, 'never get here')).catch(err => err),
  //     ]).then(([res1, res2]) => {
  //       expect(res1).toEqual('result');
  //       expect(res2).to.be.instanceOf(BetterLock.QueueOverflowError);
  //     });
  //   });
  // });
  //
  // it('will extend stack traces', () => {
  //   return (function colorfulFunctionName() {
  //     const lock = new BetterLock({
  //       wait_timeout: 0,
  //       execution_timeout: 5,
  //       queue_size: 1,
  //     });
  //
  //     return Promise.all([
  //       lock.acquire(waitWorker(25)).catch(err => err),
  //       lock.acquire(waitWorker(120)).catch(err => err),
  //       lock.acquire(waitWorker(120)).catch(err => err),
  //     ]).then(([err1, err2, err3]) => {
  //       expect(err1).to.be.instanceOf(BetterLock.ExecutionTimeoutError);
  //       expect(err1.stack.indexOf('colorfulFunctionName')).to.be.gte(0);
  //
  //       expect(err2).to.be.instanceOf(BetterLock.WaitTimeoutError);
  //       expect(err2.stack.indexOf('colorfulFunctionName')).to.be.gte(0);
  //
  //       expect(err3).to.be.instanceOf(BetterLock.QueueOverflowError);
  //       expect(err3.stack.indexOf('colorfulFunctionName')).to.be.gte(0);
  //     });
  //   })();
  // });
  //
  // it('can abort specific key', done => {
  //   const lock = new BetterLock();
  //
  //   let noCallCount = 0;
  //   const noCall = () => {
  //     noCallCount++;
  //   };
  //
  //   let result1 = undefined;
  //   lock.acquire(waitWorker(25, null, 'a')).then(res => {
  //     result1 = res;
  //   }, noCall);
  //
  //   setTimeout(() => {
  //     lock.acquire(noCall).then(noCall, err => {
  //       expect(err).to.be.instanceOf(BetterLock.JobAbortedError);
  //     });
  //   }, 5);
  //
  //   setTimeout(() => {
  //     lock.abort();
  //   }, 10);
  //
  //   setTimeout(() => {
  //     expect(noCallCount).toEqual(0);
  //     expect(result1).toEqual('a');
  //
  //     done();
  //   }, 40);
  // });
  //
  // it('can abort all', () => {
  //   const lock = new BetterLock();
  //
  //   let noCallCount = 0;
  //   const noCall = () => {
  //     noCallCount++;
  //   };
  //
  //   let cbCount = 0;
  //   const callback = err => {
  //     cbCount++;
  //     expect(err).to.be.instanceOf(BetterLock.JobAbortedError);
  //   };
  //
  //   lock.acquire(noCall, callback);
  //   lock.acquire('a', noCall, callback);
  //   lock.acquire('b', noCall, callback);
  //
  //   lock.abortAll();
  //
  //   expect(lock.canAcquire()).toBeTruthy();
  //   expect(lock.canAcquire('a')).toBeTruthy();
  //   expect(lock.canAcquire('b')).toBeTruthy();
  //   expect(cbCount).toEqual(3);
  // });
  //
  // describe('if used with promises', () => {
  //   it('will return a viable promise if called without callback', testDone => {
  //     const lock = new BetterLock();
  //
  //     const variants = [];
  //
  //     variants.push(
  //       lock.acquire(waitWorker(0, null, 'success')).then(res => {
  //         expect(res).toEqual('success');
  //
  //         return lock.acquire(waitWorker(0, 'fail')).catch(err => {
  //           expect(err).toEqual('fail');
  //           return 1;
  //         });
  //       })
  //     );
  //
  //     variants.push(
  //       lock.acquire('with key', waitWorker(0, null, 'success')).then(res => {
  //         expect(res).toEqual('success');
  //
  //         return lock.acquire('with key', waitWorker(0, 'fail')).catch(err => {
  //           expect(err).toEqual('fail');
  //           return 2;
  //         });
  //       })
  //     );
  //
  //     variants.push(
  //       lock.acquire('with key and options', waitWorker(0, null, 'success'), {}).then(res => {
  //         expect(res).toEqual('success');
  //
  //         return lock.acquire('with key and options', waitWorker(0, 'fail')).catch(err => {
  //           expect(err).toEqual('fail');
  //           return 3;
  //         });
  //       })
  //     );
  //
  //     variants.push(
  //       lock.acquire(/* just options */ waitWorker(0, null, 'success'), {}).then(res => {
  //         expect(res).toEqual('success');
  //
  //         return lock.acquire(waitWorker(0, 'fail'), {}).catch(err => {
  //           expect(err).toEqual('fail');
  //           return 4;
  //         });
  //       })
  //     );
  //
  //     Promise.all(variants)
  //       .then(results => {
  //         expect(results).to.eql([1, 2, 3, 4]);
  //         testDone();
  //       })
  //       .catch(testDone);
  //   });
  //
  //   it('will allow executor to return a promise instead of calling done', testDone => {
  //     const lock = new BetterLock();
  //
  //     lock.acquire(
  //       () => {
  //         return new Promise((resolve, reject) => {
  //           setTimeout(() => {
  //             resolve('result');
  //           }, 20);
  //         });
  //       },
  //       (err, res) => {
  //         expect(err).toBeNull();
  //         expect(res).toEqual('result');
  //       }
  //     );
  //
  //     lock.acquire(
  //       () => {
  //         return new Promise((resolve, reject) => {
  //           setTimeout(() => {
  //             reject('error');
  //           }, 20);
  //         });
  //       },
  //       err => {
  //         expect(err).toEqual('error');
  //
  //         testDone();
  //       }
  //     );
  //   });
  //
  //   it('will allow executor to directly return a value or throw an error', testDone => {
  //     const lock = new BetterLock();
  //
  //     lock.acquire(
  //       () => 'result',
  //       (err, res) => {
  //         expect(err).toBeNull();
  //         expect(res).toEqual('result');
  //       }
  //     );
  //
  //     lock.acquire(
  //       () => {
  //         throw 'error';
  //       },
  //       err => {
  //         expect(err).toEqual('error');
  //
  //         testDone();
  //       }
  //     );
  //   });
  // });
  //
  // describe('when using in multi-lock mode', () => {
  //   it('can lock on multiple keys in a basic case', () => {
  //     const lock = new BetterLock();
  //     const startedAt = new Date();
  //
  //     const sequence = [];
  //     return Promise.all([
  //       lock.acquire('a', waitWorker(50, null, 1)).then(res => sequence.push(res)),
  //       waitPromise(35).then(() =>
  //         lock.acquire('b', () => {
  //           sequence.push(2);
  //           return waitPromise(50, 2);
  //         })
  //       ),
  //       waitPromise(15).then(() =>
  //         lock.acquire(['a', 'b'], () => {
  //           sequence.push(3);
  //           return waitPromise(50, 3);
  //         })
  //       ),
  //     ]).then(res => {
  //       expect(res).to.eql([1, 2, 3]);
  //       expect(sequence).to.eql([1, 3, 2]);
  //       expect(new Date() - startedAt).to.be.within(145, 180);
  //     });
  //   });
  //
  //   it('can handle duplicate keys in the key list', () => {
  //     const lock = new BetterLock({});
  //
  //     const startedAt = new Date();
  //
  //     return Promise.all([
  //       lock.acquire(['a', undefined], waitWorker(50, null, '1')),
  //       waitPromise(5).then(() =>
  //         lock.acquire(['a', 'b', undefined, 'c', undefined, 'a'], waitWorker(50, null, '2'))
  //       ),
  //       waitPromise(15).then(() => lock.acquire('c', waitWorker(50, null, '3'))),
  //     ]).then(res => {
  //       expect(res).to.eql(['1', '2', '3']);
  //       expect(new Date() - startedAt).to.be.within(145, 180);
  //     });
  //   });
  //
  //   it('can wait timeout on partially held locks', () => {
  //     const lock = new BetterLock({
  //       wait_timeout: 20,
  //       execution_timeout: 50,
  //     });
  //
  //     const startedAt = new Date();
  //
  //     return Promise.all([
  //       // Hold a, time out execution after 50ms
  //       lock.acquire('a', waitWorker(10000, null, 1)).catch(err => err),
  //       // Wait on a, grab b, then time out on a after 20ms
  //       lock
  //         .acquire(['a', 'b'], waitWorker(50, new Error('Should never be seen')))
  //         .catch(err => err),
  //       // Wait for b, grab it when #2 times out (20ms in).
  //       lock.acquire('b', waitWorker(30, null, 3), { wait_timeout: 30 }).catch(err => err),
  //     ]).then(([res1, res2, res3]) => {
  //       expect(res1).to.be.instanceOf(BetterLock.ExecutionTimeoutError);
  //       expect(res2).to.be.instanceOf(BetterLock.WaitTimeoutError);
  //       expect(res3).toEqual(3);
  //       expect(new Date() - startedAt).to.be.within(45, 60);
  //     });
  //   });
  //
  //   it('will gracefully handle empty key lists', () => {
  //     const lock = new BetterLock({
  //       wait_timeout: 1000,
  //       execution_timeout: 1000,
  //     });
  //
  //     const startedAt = new Date();
  //     let executed = false;
  //     return lock
  //       .acquire([], () => {
  //         // Should have been executed immediately
  //         expect(new Date() - startedAt).to.be.within(0, 10);
  //         executed = true;
  //       })
  //       .finally(() => {
  //         expect(executed).toBeTruthy();
  //       });
  //   });
  // });
});

function waitWorker(ms: number, ...args): (done: (...args: any) => void) => void {
  return function (done) {
    setTimeout(() => {
      done(...args);
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

function expectMs(actual, expected, lowerBound = 5, upperBound = 50) {
  expect(actual).toBeGreaterThanOrEqual(expected - lowerBound);
  expect(actual).toBeLessThan(expected + upperBound);
}
