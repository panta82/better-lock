# Better Lock

A (better) node.js lock library.

![Travis tests](https://travis-ci.org/panta82/better-lock.svg?branch=master)

### Features

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
//...
lock
  .acquire(() => {
    // just make sure you return this promise chain
    return doSomethingThatReturnsPromise()
      .then(() => {
         return 'result';
      });
  })
  .then(
    res => {
      console.log(res); // result		
    },
    err => {
      // Either your or BetterLock's error 
  });
```

##### Advanced example

```javascript
const lock = new BetterLock({
  name: 'FileLock',                  // To be used in error reporting and logging
  log: winstonLogger.debug,          // Give it your logger with appropeiate level
  wait_timeout: 1000 * 30,           // Max 30 sec wait in queue
  execution_timeout: 1000 * 60 * 5,  // Time out after 5 minutes
   queue_size: 1,                     // At most one pending job
});

function processFile(filename, callback) {
  lock.acquire(filename, () => {
    return appendToFile(filename)
      .then(result => {
        return updateDb(result);
      });
  }).then(result => {
    callback(null, {
      status: true,
      result,
    });
  }).catch(err => {
    if (err instanceof BetterLock.QueueOverflowError) {
      return callback(null, {
        status: false, // The job was discarded
      });
    }
    if (err instanceof BetterLock.ExecutionTimeoutError) {
      winstonLogger.warn('Potential swallowed callback! Stack trace to the entry site:', err.stack);
    }
    return callback(err);
  });
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
}, (err) => {
  // Outside the lock
  if (err) {
    // Either your od BetterLock's error
    console.error(err); 
  }
});
```

You can see a bunch more usage examples in the spec file, [here](spec/better_lock.spec.js);

### API

- `new BetterLock(options)`  
  Create a new instance of `BetterLock`. Options should match interface of `BetterLockOptions`. See below for details.

- `BetterLock.acquire([key], executor, [callback], [jobOptions])`  
  The main method you'll want to call. For each `key`, given `executor` will be called only one at a time. Returns a promise that will be resolved with whatever `executor` returns.
  - `key`: Arbitrary string under which to lock. It allows you to use the same lock instance for multiple parallel concerns. Eg. this might be a database record id or filename.
  - `executor`: Function that will be called within the lock. This function should have one of two forms.
    1. *Without arguments*, in which case it should return a promise. Lock will remain locked until the promise resolves.
    2. *With single `done`* argument. In this case, the executor should call `done(err, res)` once it is done. Arguments passed to done will be passed to the callback of the lock.
  - `callback`: Optional callback that will be called once executor exits. Results from executor (resolved/rejected value or arguments given to `done`) will be passed along. This can be used in addition to the returned promise.
  - `jobOptions`: An object that should match interface of `LockJobOptions`. A subset of main options that will serve as overrides for this particular job (for example, timeout settings).

- `BetterLock.canAcquire([key])`  
  Returns true if given key can be acquired.

- `BetterLock.abort([key])`  
  Abort all jobs for a given key (or from the default job queue, if no key is given). Job executors will not be called. Callbacks will be called with `JobAbortedError`. Currently executing job will not be interrupted.

- `BetterLock.abortAll()`  
  Abort all jobs for all keys. This is suitable to be called during shutdown of your app.


### Options

All available options with defaults can be seen [here](src/options.js).

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

During runtime, you can change the defaults like this:

```javascript
const BetterLock = require('better-lock');

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

### More usage examples

You can see a bunch more usage examples in the spec file, [here](spec/better_lock.spec.js);

### Change log

Date|Version|Change
----|-------|------
2018/06/04|0.1.1|You can now use a Number as job name
2018/09/27|0.2.0|Code reformat, better pattern for loading options. No feature upgrades.
2018/09/27|0.2.1|Better and customizable Promise detection. Restored DEFAULT_OPTIONS.
2018/10/01|0.3.0|Can abort jobs waiting in queue.
2018/10/01|0.3.1|Updated CI to use the current node versions (0.8 & 0.10). Older node versions should continue to work, but are no longer tested. Also, README updates.
2019/01/28|1.0.0|Major update. Added multi-key locks and refactored a bunch of internals. Removed `OVERFLOW_STRATEGIES` and related options, which is mostly the reason for the major version bump. The library should otherwise work the same.

### Development

Fork, then git clone. The project is already set up with a WebStorm project, if that's your cup of tee.

To run tests, with coverage:
```
npm run test
```

If you want to contribute, create a branch off master, do your work and then make a pull request against master. Unit tests would be appreciated.

## License

[MIT](./LICENSE)