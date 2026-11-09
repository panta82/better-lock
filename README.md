# Better Lock

A (better) node.js lock library.

### Features

- Typescript-ready
- Named and keyed locks
- Queue and execution timeouts
- Queue size limit
- Lock on multiple keys
- Reentrancy, with deadlock prevention (Node.js)
- Executors run in the caller's async context, preserving `AsyncLocalStorage` stores (Node.js)
- Extended stack traces
- Promise and callback interface
- JSDoc annotations
- Good error messages
- Unit tests, good code coverage
- No dependencies

### Installation

```bash
npm install --save better-lock
# or
yarn add better-lock
```

### Browser usage

Better Lock can be bundled for frontend use. A lock coordinates asynchronous work only within the
current JavaScript context; it is not shared between tabs, workers, or other devices.

```typescript
import BetterLock from 'better-lock';

const lock = new BetterLock();
```

The published package is CommonJS, so use it through a frontend bundler such as Vite or webpack. It
cannot be loaded directly from a browser `<script type="module">` tag.

Extended stack traces are enabled by default when the runtime supports `Error.captureStackTrace`.
In browsers without that API, Better Lock automatically skips stack extension and otherwise works
normally.

[Async context](#async-context) and [reentrancy](#reentrancy) require Node.js `async_hooks`, so they are unavailable in
browsers. See [Runtime support](#runtime-support).

### Documentation

Full docs: <https://panta82.github.io/better-lock/>

##### Minimal example

```javascript
const lock = new BetterLock();

try {
  const res = await lock.acquire(async () => {
    // Inside the lock. It will stay closed until the promise you return resolves or rejects.
    await doSomeAsyncTask();
    return 'my result';
  });

  // Outside the lock. You will get whatever the promise chain has returned.
  console.log(res); // "my result"
} catch (err) {
  // Either your or BetterLock's error
}
```

##### Advanced example

```typescript
const lock = new BetterLock({
  name: 'FileLock', // To be used in error reporting and logging
  log: winstonLogger.debug, // Give it your logger with appropeiate level
  wait_timeout: 1000 * 30, // Max 30 sec wait in queue
  execution_timeout: 1000 * 60 * 5, // Time out after 5 minutes
  queue_size: 1, // At most one pending job
});

async function processFile(filename) {
  try {
    const result = await lock.acquire(filename, async () => {
      const appended = await appendToFile(filename);
      return updateDb(appended);
    });
    return {
      status: true,
      result,
    };
  } catch (err) {
    if (err instanceof BetterLock.QueueOverflowError) {
      // The job was discarded
      return {
        status: false,
      };
    }

    if (err instanceof BetterLock.ExecutionTimeoutError) {
      winstonLogger.warn('Potential swallowed callback! Stack trace to the entry site:', err.stack);
    }
    throw err;
  }
}
```

##### Locking on multiple keys

```javascript
const userLock = new BetterLock({
  name: 'User lock',
  executionTimeout: 1000 * 60 * 60, // Note you can also use camelCase
});

function transferBetweenUsers(fromId, toId, amount) {
  userLock
    .acquire([fromId, toId], () => {
      return Promise.all([User.get(fromId), User.get(toId)]).then(([fromUser, toUser]) => {
        fromUser.amount -= amount;
        toUser.amount += amount;
        return Promise.all([user1.save(), user2.save()]);
      });
    })
    .then(() => {
      console.log('Transfer completed');
    });
}
```

##### Using callback interface

```javascript
const BetterLock = require('better-lock');

const lock = new BetterLock();
//...
lock.acquire(
  done => {
    // Inside the lock
    doMyAsyncStuffHere(err => {
      // Call done when done
      done(err);
    });
  },
  (err, result) => {
    // Outside the lock
    if (err) {
      // Either your or BetterLock's error
      console.error(err);
    }
  }
);
```

### API

- `new BetterLock(options)`  
  Create a new instance of `BetterLock`. Options should match interface `BetterLockOptions`. See below for details.

- `BetterLock.acquire([key], executor, [callback], [jobOptions])`  
  The main method you'll want to call. For each `key`, given `executor` will be called only one at a time. If you don't provide `callback`, it will return a promise that will be resolved with whatever `executor` returns. If the caller already holds the keys, the executor runs without waiting (see [Reentrancy](#reentrancy)).

  - `key`: Arbitrary string under which to lock. It allows you to use the same lock instance for multiple parallel concerns. Eg. this might be a database record id or filename.
  - `executor`: Function that will be called within the lock. This function should have one of two forms.
    1. _Without arguments_, in which case it should return a promise. Lock will remain locked until the promise resolves.
    2. _With single `done`_ argument. In this case, the executor should call `done(err, res)` once it is done. Arguments passed to done will be passed to the callback of the lock.
  - `callback`: Optional callback that will be called once executor exits. Results from executor (resolved/rejected value or arguments given to `done`) will be passed along. This can be used in addition to the returned promise.
  - `jobOptions`: An object that should match interface `BetterLockJobOptions`. A subset of main options that will serve as overrides for this particular job (for example, timeout settings).

- `BetterLock.acquireOr([key], failureResult, executor, [callback], [jobOptions])`  
  The same as acquire, except if the lock can't be acquired (the executor never gets called), instead of throwing
  an error, the lock will resolve/callback with the provided failureResult value (for example, a `null`).

- `BetterLock.canAcquire([key])`  
  Returns true if the given key can be acquired immediately: nothing holds it and nothing waits for it, or the caller already holds it and reentrancy is allowed.

- `BetterLock.abort([key])`  
  Abort all jobs for a given key (or from the default job queue, if no key is given). Job executors will not be called. Callbacks will be called with `JobAbortedError`. Currently executing job will not be interrupted.

- `BetterLock.abortAll()`  
  Abort all jobs for all keys. This is suitable to be called during shutdown of your app.

### Options

All available options can be seen [here](https://panta82.github.io/better-lock/interfaces/BetterLockOptions).

`BetterLockOptions` are provided when you construct a lock instance. A subset of options given in `LockJobOptions` can be provided when you call `lock.acquire`, as the last argument.

Example:

```javascript
lock.acquire(executor, callback, {
  wait_timeout: 1000,
});
```

Most commonly used options are:

- `wait_timeout`  
  How long can jobs wait in queue before timing out (ms). Null to disable timeout.

- `execution_timeout`  
  How long can a job be executing before timing out (ms). Null to disable timeout.
  If you do that, though, and you have a swallowed callback, the lock can remain locked permanently.

- `queue_size`  
  Max queue size for waiting jobs.

- `reentrancy`
  `'allow'` (default) or `'error'`. What to do when the caller already holds all the requested keys. See [Reentrancy](#reentrancy).

Default options are a static member `DEFAULT_OPTIONS` on the `BetterLock` class. During runtime, you can change the defaults like this:

```javascript
import BetterLock from 'better-lock';

BetterLock.DEFAULT_OPTIONS.wait_timeout = 1000;
```

### Reentrancy

Reentrancy means you can re-take the same lock from within the lock. This uses node's [AsyncLocalStorage](https://beta.docs.nodejs.org/async_context#class-asynclocalstorage) under the hood.

```javascript
const lock = new BetterLock();

async function saveUser(user) {
  return lock.acquire(user.id, () => db.save(user));
}

async function renameUser(id, name) {
  return lock.acquire(id, async () => {
    const user = await db.load(id);
    user.name = name;
    // Holds `id` already, so this doesn't wait
    return saveUser(user);
  });
}
```

If you use multi-keys, the reentrancy will only work if you already hold _all_ the requested keys. Otherwise, the acquire fails with `BetterLockReentrancyError` (passed to the callback, or rejected from the promise), to prevent deadlocks. `acquireOr` passes it on too, instead of returning `failureResult`.

Reentrant acquire works transparently. You'll get an immediate callback in the next tick, without taking any extra slots. `canAcquire(key)` returns true. If `lock_condition` rejects the key, nothing is locked, so there is nothing to reenter.

### Async context

Executors and callbacks run in the async context of the `acquire` call. If you use `AsyncLocalStorage` (eg. for request ids in logs), code inside the executor sees the store of whoever called `acquire`, even if it had to wait for another caller to release the lock.

```javascript
const requestContext = new AsyncLocalStorage();

requestContext.run({ requestId: 1 }, () => lock.acquire(() => slowTask()));
requestContext.run({ requestId: 2 }, () =>
  lock.acquire(() => {
    // Runs after request 1 releases the lock, but still sees request 2's store
    console.log(requestContext.getStore().requestId); // 2
  })
);
```

### When to use

This library is a good fit if:

- You need a local lock in your node.js application.
- You have some advanced needs, like multiple keys per lock, timeouts, aborting...
- You like good error messages, with full stack traces.
- You like good types, either through typescript or JSDoc comments

The library is not a good fit if you need a **shared lock between different processes**. BetterLock is single process only.

### Change log

#### **4.0.0** (_2026/11/09_)

- Added **reentrancy**, You can now acquire the same lock again from within the lock. Set `options.reentrancy` to `"error"` to fail with `BetterLockReentrancyError` instead of re-locking the keys.
- Executors and callbacks run in the async context of their `acquire` call, so `AsyncLocalStorage` stores no longer leak from the previous lock holder.
- Both features require `process.getBuiltinModule` (Node.js 20.16+ or 22.3+). In other runtimes, the lock behaves as before.

#### **3.3.0** (_2026/08/25_)

Make the library compatible with browsers.

#### **3.2.0** (_2024/06/21_)

Add new api `canAcquire`. A helper for "best effort" lock acquisition.

#### **3.2.0** (_2024/06/21_)

Add new api `canAcquire`. A helper for "best effort" lock acquisition.

#### **3.1.0** (_2024/06/21_)

Add option `lock_condition`.

#### **3.0.0** (_2024/04/18_)

Add option `queue_ejection_strategy`.

Major version bump because the default strategy changed from "newest" (the old assumed value) to "newest" (makes more sense).

To migrate, specify:

```javascript
{
  "queue_ejection_strategy": "newest"
}
```

in your job options.

#### **2.0.3** (_2022/05/28_)

Introduce generated API docs. Remove beta tag from npm version.

#### **2.0.0** (_2021/05/30_)

Major update. The entire library was rewritten in typescript, so you should now get typings in most editors. We also had to switch tests from mocha + chai to jest (easier ts integration).

The API and features have remained largely the same, just a bit of a refresh.

Non-breaking and internal changes:

- We now export all error names as a type script type. A few other types as well.
- Errors now have `name` parameter, which matches these names.

Breaking changes:

- You can no longer use camel case versions of external-facing objects. Eg. you can no longer pass `waitTimeout` instead of `wait_timeout`. In retrospect, this was a pretty flaky API to maintain.

- Internal `LockJob` class is no longer exported.

- Also, errors no longer expose internal `LockJob` instances (`err.job`). We now instead provide the most important fields from the job (`id` and `keys`).

- Error names have been renamed to have `BetterLock` prefix. Eg. `WaitTimeoutError` -> `BetterLockWaitTimeoutError`. This will influence `err.name` and `err.message` parameters. The idea here is, if you see `BetterLock` error in the wild, you will know what generated it.

- We have renamed `BetterLock.BetterLockError` to `BetterLock.BaseError` and `BetterLock.BetterLockInternalError` to `BetterLock.InternalError` to better match the naming scheme.

- Since Options are no longer a class but interface, we are no longer exporting them under `BetterLock.Options`. You can do `import {BetterLockOptions} from 'better-lock';` to get the typescript type.

#### **1.0.1** (_2019/01/28_)

Handle empty key list

#### **1.0.0** (_2019/01/28_)

Major version bump.

- Added multi-key locks and refactored a bunch of internals.
- Removed `OVERFLOW_STRATEGIES` and related options, which is mostly the reason for the major version bump. The library should otherwise work the same.

#### **0.3.1** (_2018/10/01_)

Updated CI to use the current node versions (0.8 & 0.10). Older node versions should continue to work, but are no longer tested. Also, README updates.

#### **0.3.0** (_2018/10/01_)

Can abort jobs waiting in queue.

#### **0.2.1** (_2018/09/27_)

- Better and customizable Promise detection.
- Restored DEFAULT_OPTIONS.

#### **0.2.0** (_2018/09/27_)

Code reformat, better pattern for loading options. No feature upgrades.

#### **0.1.1** (_2018/06/04_)

You can now use a Number as job name

### Development

Fork, then git clone. The project is already set up with a WebStorm project, if that's your cup of tee.

To run tests, with coverage:

```
npm run test
```

If you want to contribute, create a branch off master, do your work and then make a pull request against master. Unit tests would be appreciated.

## License

[MIT](./LICENSE)
