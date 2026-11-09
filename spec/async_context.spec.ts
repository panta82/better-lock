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

  it('queues a nested acquire of a held key until the holder finishes, in its own context', async () => {
    const lock = new BetterLock({ wait_timeout: 500 });
    const events: string[] = [];
    let seen: string;
    let nested: Promise<any>;

    await store.run('holder', () =>
      lock.acquire('a', async () => {
        // Not awaited, eg. an event handler fired from inside the critical section
        store.run('nested', () => {
          nested = lock.acquire('a', async () => {
            events.push('nested');
            seen = store.getStore();
          });
        });
        await waitPromise(20);
        events.push('holder');
      })
    );
    await nested;

    expect(events).toEqual(['holder', 'nested']);
    expect(seen).toEqual('nested');
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
