import { AsyncLocalStorage } from 'async_hooks';

import BetterLock from '../src/index';

describe('BetterLock async context', () => {
  const store = new AsyncLocalStorage<string>();

  it('runs a contended executor in the context of its own acquire call', async () => {
    const lock = new BetterLock();
    const seen: Record<string, string> = {};

    await Promise.all([
      store.run('first', () =>
        lock.acquire(async () => {
          await waitPromise(20);
          seen.first = store.getStore();
        })
      ),
      store.run('second', () =>
        lock.acquire(async () => {
          seen.second = store.getStore();
        })
      ),
      store.run('third', () =>
        lock.acquire(done => {
          seen.third = store.getStore();
          done(null);
        })
      ),
    ]);

    expect(seen).toEqual({ first: 'first', second: 'second', third: 'third' });
  });

  it('calls the callback in the context of its own acquire call', testDone => {
    const lock = new BetterLock({ queue_size: 1 });

    store.run('first', () => lock.acquire(waitCallback(20), () => {}));
    store.run('second', () =>
      lock.acquire(waitCallback(0), err => {
        // Kicked out by the third acquire, from its context
        expect(err).toBeInstanceOf(BetterLock.QueueOverflowError);
        expect(store.getStore()).toEqual('second');
        testDone();
      })
    );
    store.run('third', () => lock.acquire(waitCallback(0), () => {}));
  });

  it('leaves the uncontended path unchanged', async () => {
    const lock = new BetterLock();
    const startedAt = Date.now();

    const result = await store.run('only', () => {
      const promise = lock.acquire(async () => store.getStore());
      expect(lock.canAcquire()).toBeFalsy();
      return promise;
    });

    expect(result).toEqual('only');
    expectMs(Date.now() - startedAt, 0);
    expect(lock.canAcquire()).toBeTruthy();
  });
});

describe('BetterLock reentrancy', () => {
  it('runs a reentrant acquire immediately, when the caller holds all keys', async () => {
    const lock = new BetterLock({ wait_timeout: 50 });
    const startedAt = Date.now();

    const result = await lock.acquire(['a', 'b'], async () => {
      expect(lock.canAcquire('a')).toBeTruthy();
      const inner = await lock.acquire(['b', 'a'], async () => {
        return lock.acquire('a', async () => 'innermost');
      });
      const viaCallback = await new Promise((resolve, reject) => {
        lock.acquire(
          'b',
          done => done(null, 'callback'),
          (err, res) => (err ? reject(err) : resolve(res))
        );
      });
      return [inner, viaCallback];
    });

    expect(result).toEqual(['innermost', 'callback']);
    expectMs(Date.now() - startedAt, 0);
    expect(lock.canAcquire('a')).toBeTruthy();
    expect(lock.canAcquire('b')).toBeTruthy();
  });

  it('treats the default key as a key', async () => {
    const lock = new BetterLock({ wait_timeout: 50 });

    const result = await lock.acquire(() => lock.acquire(() => Promise.resolve('nested')));

    expect(result).toEqual('nested');
  });

  it('counts keys held by all executing jobs in the context', async () => {
    const lock = new BetterLock({ wait_timeout: 50 });

    const result = await lock.acquire('a', () =>
      lock.acquire('b', () => lock.acquire(['a', 'b'], async () => 'both'))
    );

    expect(result).toEqual('both');
  });

  it('lets parallel branches of the holder both pass as reentrant', async () => {
    const lock = new BetterLock({ wait_timeout: 50 });
    let running = 0;
    let maxRunning = 0;

    const branch = () =>
      lock.acquire('a', async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await waitPromise(10);
        running--;
      });

    await lock.acquire('a', () => Promise.all([branch(), branch()]));

    expect(maxRunning).toEqual(2);
  });

  it('applies the execution timeout to the reentrant job', async () => {
    const lock = new BetterLock({ execution_timeout: 200 });

    const result = await lock.acquire('a', async () => {
      const err = await lock
        .acquire('a', () => waitPromise(50), { execution_timeout: 10 })
        .catch(err => err);
      return err;
    });

    expect(result).toBeInstanceOf(BetterLock.ExecutionTimeoutError);
  });

  it('can abort a reentrant job that has not started yet', async () => {
    const lock = new BetterLock();
    let called = false;

    const result = await lock.acquire('a', async () => {
      const promise = lock.acquire('a', async () => {
        called = true;
      });
      lock.abort('a');
      return promise.catch(err => err);
    });

    expect(result).toBeInstanceOf(BetterLock.JobAbortedError);
    expect(called).toBeFalsy();
  });

  it('does not share held keys between lock instances', async () => {
    const lock1 = new BetterLock();
    const lock2 = new BetterLock({ wait_timeout: 20 });

    const blocker = lock2.acquire('a', () => waitPromise(50));
    const result = await lock1.acquire('a', () =>
      lock2.acquire('a', async () => 'ok').catch(err => err)
    );
    await blocker;

    expect(result).toBeInstanceOf(BetterLock.WaitTimeoutError);
  });

  it('rejects when the caller holds only some of the requested keys', async () => {
    const lock = new BetterLock({ wait_timeout: 50 });
    let called = false;

    const err = await lock.acquire('a', () =>
      lock
        .acquire(['a', 'b'], async () => {
          called = true;
        })
        .catch(err => err)
    );

    expect(err).toBeInstanceOf(BetterLock.ReentrancyError);
    expect(err.keys).toEqual(['a', 'b']);
    expect(err.held_keys).toEqual(['a']);
    expect(err.stack).toContain('async_context.spec');
    expect(called).toBeFalsy();
    expect(lock.canAcquire('a')).toBeTruthy();
    expect(lock.canAcquire('b')).toBeTruthy();
  });

  it('passes the reentrancy error to the callback, on a later tick', testDone => {
    const lock = new BetterLock();

    lock.acquire('a', async () => {
      let returned = false;
      lock.acquire(
        ['a', 'b'],
        done => done(null),
        err => {
          expect(returned).toBeTruthy();
          expect(err).toBeInstanceOf(BetterLock.ReentrancyError);
          testDone();
        }
      );
      returned = true;
    });
  });

  it('rejects acquireOr with the reentrancy error instead of returning the failure result', async () => {
    const lock = new BetterLock();

    const result = await lock.acquire('a', () =>
      lock.acquireOr(['a', 'b'], 'failure', async () => 'never').catch(err => err)
    );

    expect(result).toBeInstanceOf(BetterLock.ReentrancyError);
  });

  it('rejects any reentrant acquire in "error" mode', async () => {
    const lock = new BetterLock({ reentrancy: 'error' });

    const results = await lock.acquire('a', async () => {
      expect(lock.canAcquire('a')).toBeFalsy();
      return Promise.all([
        lock.acquire('a', async () => null).catch(err => err),
        lock.acquire(['a'], async () => null).catch(err => err),
        // Not reentrant, so allowed
        lock.acquire('b', async () => 'other key'),
      ]);
    });

    expect(results[0]).toBeInstanceOf(BetterLock.ReentrancyError);
    expect(results[0].held_keys).toEqual(['a']);
    expect(results[1]).toBeInstanceOf(BetterLock.ReentrancyError);
    expect(results[2]).toEqual('other key');
  });

  it('can switch to "error" mode per job', async () => {
    const lock = new BetterLock();

    const err = await lock.acquire('a', () =>
      lock.acquire('a', async () => null, { reentrancy: 'error' }).catch(err => err)
    );

    expect(err).toBeInstanceOf(BetterLock.ReentrancyError);
  });

  it('does not count detached work that runs after the holder has finished', async () => {
    const lock = new BetterLock({ wait_timeout: 500 });
    const events: string[] = [];
    let detached: Promise<any>;

    await lock.acquire('a', async () => {
      setTimeout(() => {
        detached = lock.acquire('a', async () => {
          events.push('detached');
        });
      }, 20);
    });

    // Someone else grabs the key before the detached work runs
    const other = lock.acquire('a', async () => {
      await waitPromise(50);
      events.push('other');
    });

    await other;
    await detached;

    expect(events).toEqual(['other', 'detached']);
  });

  it('queues a reentrant acquire normally if its holder ends before it starts', async () => {
    const lock = new BetterLock({ wait_timeout: 500 });
    const events: string[] = [];
    let unawaited: Promise<any>;

    const holder = lock.acquire('a', () => {
      // Returns synchronously, so the holder ends before the nested executor starts
      unawaited = lock.acquire('a', async () => {
        events.push('unawaited');
      });
    });
    const waiter = lock.acquire('a', async () => {
      await waitPromise(20);
      events.push('waiter');
    });

    await Promise.all([holder, waiter]);
    await unawaited;

    expect(events).toEqual(['waiter', 'unawaited']);
  });

  it('skips reentrancy when lock_condition rejects the key', async () => {
    const lock = new BetterLock({ reentrancy: 'error', lock_condition: key => key !== 'free' });

    const result = await lock.acquire('a', () => lock.acquire('free', async () => 'unlocked'));

    expect(result).toEqual('unlocked');
  });
});

describe('BetterLock without async_hooks', () => {
  let FallbackLock: typeof BetterLock;

  beforeAll(() => {
    const processObject = globalThis.process as any;
    const original = processObject.getBuiltinModule;
    processObject.getBuiltinModule = () => undefined;
    try {
      jest.isolateModules(() => {
        FallbackLock = require('../src/index').default;
      });
    } finally {
      processObject.getBuiltinModule = original;
    }
  });

  it('runs a contended executor in the context of the previous holder, as before', async () => {
    const store = new AsyncLocalStorage<string>();
    const lock = new FallbackLock();
    let seen: string;

    await Promise.all([
      store.run('first', () => lock.acquire(() => waitPromise(20))),
      store.run('second', () =>
        lock.acquire(async () => {
          seen = store.getStore();
        })
      ),
    ]);

    expect(seen).toEqual('first');
  });

  it('makes a nested acquire wait for itself, as before', async () => {
    const lock = new FallbackLock({ wait_timeout: 20, reentrancy: 'error' });
    expect(FallbackLock.ReentrancyError).toBeDefined();

    const result = await lock.acquire('a', async () => {
      expect(lock.canAcquire('a')).toBeFalsy();
      return lock.acquire('a', async () => 'never').catch(err => err);
    });

    expect(result).toBeInstanceOf(FallbackLock.WaitTimeoutError);
  });

  it('does not reject partially held keys, as before', async () => {
    const lock = new FallbackLock({ wait_timeout: 20 });

    const result = await lock.acquire('a', () =>
      lock.acquire(['a', 'b'], async () => 'never').catch(err => err)
    );

    expect(result).toBeInstanceOf(FallbackLock.WaitTimeoutError);
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

function expectMs(actual, expected, lowerBound = 5, upperBound = 80) {
  expect(actual).toBeGreaterThanOrEqual(expected - lowerBound);
  expect(actual).toBeLessThan(expected + upperBound);
}
