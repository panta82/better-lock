# Better Lock

A (better) node.js lock library.

![Travis tests](https://travis-ci.org/panta82/better-lock.svg?branch=master)

### Features

- Typescript-ready
- Named and keyed locks
- Queue and execution timeouts
- Queue size limit
- Lock on multiple keys
- Extended stack traces
- Promise and callback interface
- JSDoc annotations
- Good error messages
- Unit tests, good code coverage
- No dependencies

### Installation

```bash
npm install --save better-lock
```

### Usage examples

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
}
catch (err) {
  // Either your or BetterLock's error
}
```

##### Advanced example

```typescript
const lock = new BetterLock({
  name: 'FileLock',                  // To be used in error reporting and logging
  log: winstonLogger.debug,          // Give it your logger with appropeiate level
  wait_timeout: 1000 * 30,           // Max 30 sec wait in queue
  execution_timeout: 1000 * 60 * 5,  // Time out after 5 minutes
  queue_size: 1,                     // At most one pending job
});

async function processFile(filename) {
  try {
    const result = await lock.acquire(filename, async () => {
      const appended = await appendToFile(filename);
      return updateDb(appended);
    });
    return {
      status: true,
      result
    };
  }
  catch (err) {
    if (err instanceof BetterLock.QueueOverflowError) {
      // The job was discarded
      return {
        status: false
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
  userLock.acquire([fromId, toId], () => {
    return Promise.all([
      User.get(fromId),
      User.get(toId),
    ]).then(([fromUser, toUser]) => {
      fromUser.amount -= amount;
      toUser.amount += amount;
      return Promise.all([
        user1.save(),
        user2.save(),
      ]);
    });
  }).then(() => {
    console.log('Transfer completed');
  });
}
```

##### Using callback interface

```javascript
const BetterLock = require('better-lock');

const lock = new BetterLock();
//...
lock.acquire(done => {
  // Inside the lock
  doMyAsyncStuffHere((err) => {
    // Call done when done
    done(err);
  });
}, (err, result) => {
  // Outside the lock
  if (err) {
    // Either your or BetterLock's error
    console.error(err);
  }
});
```

You can see a bunch more usage examples in the spec file, [here](spec/better_lock.spec.js);

### API

- `new BetterLock(options)`  
  Create a new instance of `BetterLock`. Options should match interface `BetterLockOptions`. See below for details.

- `BetterLock.acquire([key], executor, [callback], [jobOptions])`  
  The main method you'll want to call. For each `key`, given `executor` will be called only one at a time. If you don't provide `callback`, it will return a promise that will be resolved with whatever `executor` returns.

  - `key`: Arbitrary string under which to lock. It allows you to use the same lock instance for multiple parallel concerns. Eg. this might be a database record id or filename.
  - `executor`: Function that will be called within the lock. This function should have one of two forms.
    1. _Without arguments_, in which case it should return a promise. Lock will remain locked until the promise resolves.
    2. _With single `done`_ argument. In this case, the executor should call `done(err, res)` once it is done. Arguments passed to done will be passed to the callback of the lock.
  - `callback`: Optional callback that will be called once executor exits. Results from executor (resolved/rejected value or arguments given to `done`) will be passed along. This can be used in addition to the returned promise.
  - `jobOptions`: An object that should match interface `BetterLockJobOptions`. A subset of main options that will serve as overrides for this particular job (for example, timeout settings).

- `BetterLock.canAcquire([key])`  
  Returns true if given key can be acquired.

- `BetterLock.abort([key])`  
  Abort all jobs for a given key (or from the default job queue, if no key is given). Job executors will not be called. Callbacks will be called with `JobAbortedError`. Currently executing job will not be interrupted.

- `BetterLock.abortAll()`  
  Abort all jobs for all keys. This is suitable to be called during shutdown of your app.

### Options

All available options can be seen [here](src/options.ts).

`BetterLockOptions` are provided when you construct a lock instance. A subset of options given in `LockJobOptions` can be provided when you call `lock.acquire`, as the last argument.

Example:

```javascript
lock.acquire(executor, callback, {
  wait_timeout: 1000
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

Options are presented using `snake_case`, but you can also provide them using `camelCase` keys, if that better suits your code style (eg. `extend_stack_traces` becomes `extendStackTraces`).

Default options are a static member `DEFAULT_OPTIONS` on the `BetterLock` class. That can be seen [here](src/better_lock.ts). During runtime, you can change the defaults like this:

```javascript
import BetterLock from 'better-lock';

BetterLock.DEFAULT_OPTIONS.wait_timeout = 1000;
```

### Motivation

I needed something like [async-lock](https://github.com/rogierschouten/async-lock), but a bit easier to debug.

This library improves upon `async-lock` in following ways:

- Good error messages and log facility
- Added features (execution timeout, abort jobs...)
- Extended stack traces (so when you get an error, you have a full stack trace of the original calling code)
- JSDoc comments (helps if you're using an IDE)

Following features are present in both libraries:

- Multiple keys per lock instance
- Acquire multiple keys in a single call
- Interface, with executor and the callback function
- Promises
- Timeout and queue limit

Following features are present in `async-lock`, but not here:

- Domain reentrancy (domains are going away)

**NOTE:** If you want to sync multiple node instances doing the same operation, this library will not help you. You need something that works over network and can use a shared arbiter of who gets the lock (eg. redis).

### Change log

#### **0.1.1** (_2018/06/04_)

You can now use a Number as job name

#### **0.2.0** (_2018/09/27_)

Code reformat, better pattern for loading options. No feature upgrades.

#### **0.2.1** (_2018/09/27_)

- Better and customizable Promise detection.
- Restored DEFAULT_OPTIONS.

#### **0.3.0** (_2018/10/01_)

Can abort jobs waiting in queue.

#### **0.3.1** (_2018/10/01_)

Updated CI to use the current node versions (0.8 & 0.10). Older node versions should continue to work, but are no longer tested. Also, README updates.

#### **1.0.0** (_2019/01/28_)

Major version bump.

- Added multi-key locks and refactored a bunch of internals.
- Removed `OVERFLOW_STRATEGIES` and related options, which is mostly the reason for the major version bump. The library should otherwise work the same.

#### **1.0.1** (_2019/01/28_)

Handle empty key list

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

### Development

Fork, then git clone. The project is already set up with a WebStorm project, if that's your cup of tee.

To run tests, with coverage:

```
npm run test
```

If you want to contribute, create a branch off master, do your work and then make a pull request against master. Unit tests would be appreciated.

## License

[MIT](./LICENSE)
