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


##### Using full options

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


### Motivation

I needed something like [async-lock](https://github.com/rogierschouten/async-lock), but a bit easier to debug.

This library improves upon `async-lock` in following ways:

- Good error messages and log facility
- Execution timeout
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

### Options

All available options with defaults can be seen [here](src/options.js). `BetterLockOptions` are provided when you construct a lock instance. A subset of options given in `LockJobOptions` can be provided when you call `lock.acquire`, as the last argument.

```javascript
lock.acquire(executor, callback, {
	wait_timeout: 1000
});
```

Options are presented using `snake_case`, but you can also provide them using `camelCase` keys, if that better suits your code style (eg. `extend_stack_traces` becomes `extendStackTraces`). 

During runtime, you can change the defaults like this:

```javascript
const BetterLock = require('better-lock');

BetterLock.DEFAULT_OPTIONS.wait_timeout = 1000;
```

### More usage examples

You can see a bunch more usage examples in the spec file, [here](spec/better_lock.spec.js);

### Change log

Date|Change
----|------
2018/06/04|You can now use a Number as job name

### Development

Fork, then git clone. The project is already set up with a WebStorm project, if that's your cup of tee.

To run tests, with coverage:
```
npm run test
```

If you want to contribute, create a branch off master, do your work and then make a pull request against master. Unit tests would be appreciated.

## License

[MIT](./LICENSE)