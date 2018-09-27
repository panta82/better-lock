# Better Lock

A (better) node.js lock library.

![Travis tests](https://travis-ci.org/panta82/better-lock.svg?branch=master)

### Features

- Named and keyed locks
- Queue and execution timeouts
- Queue size limit
- Extended stack traces
- Optional promise interface
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
    .then(res => {
        console.log(res); // result		
    })
    .catch(err => {
        // Either your od BetterLock's error 
    });
```

##### Minimal example with callbacks

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

##### Kitchen sink example

```javascript
const lock = new BetterLock({
    name: 'FileLock',                  // To be used in error reporting and logging
    log: winstonLogger.debug,          // Give it your logger with appropeiate level
    wait_timeout: 1000 * 30,           // Max 30 sec wait in queue
    execution_timeout: 1000 * 60 * 5,  // Time out after 5 minutes
    queue_size: 1,                     // At most one pending job
    overflow_strategy: BetterLock
        .OVERFLOW_STRATEGIES.kick_last // Queue the latest call, kick out the prev one
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
            result
        });
    }).catch(err => {
        if (err instanceof BetterLock.QueueOverflowError) {
            return callback(null, {
                status: false // The job was discarded
            });
        }
        if (err instanceof BetterLock.ExecutionTimeoutError) {
            winstonLogger.warn('Potential swallowed callback! Stack trace to the entry site:', err.stack);
        }
        return callback(err);
    });
}

```

### Motivation

I was using [async-lock](https://github.com/rogierschouten/async-lock) in a work project. Something was swallowing a callback in production. Not only did async-lock did nothing to prevent it, it was very spartan with its error messages.

So, as a weekend project, I have decided to improve on `async-lock` it in the following ways:

- Good error messages and log facility
- Execution timeout
- Extended stack traces (so when you get an error, you have a full stack trace of the original calling code)
- JSDoc comments (helps if you're using an IDE)

I have kept the following good aspects of async-lock:

- Multiple keys per lock
- Interface, with executor and the callback function
- Promises
- Timeout and queue limit

I have decided to not implement the following features:

- Domain reentrancy (domains are going away)
- Acquire multiple keys (TODO)

**NOTE:** If you want to sync multiple node instances doing the same operation, this library will not help you. You need something that works over network and can use a shared arbiter of who gets the lock (eg. redis).

### Options

Most commonly used options are:

- `wait_timeout`  
  How long can jobs wait in queue before timing out (ms). Null to disable timeout.

- `execution_timeout`  
  How long can a job be executing before timing out (ms). Null to disable timeout.
  If you do that, though, and you have a swallowed callback, the lock can remain locked permanently.

- `queue_size`  
  Max queue size for waiting jobs.

More fiddly options with comments can be seen in [here](src/options.js).

Options are provided when you construct a lock instance. Some option overrides are also available when you call `lock.acquire`, as the last argument (namely, timeouts).

```javascript
lock.acquire(executor, callback, {
	wait_timeout: 1000
});
```

Options are presented using `snake_case`, but you can also provide them using `camelCase` keys, if that better suits your code style (eg. `extend_stack_traces` becomes `extendStackTraces`). 

### More usage examples

You can see a bunch more usage examples in the spec file, [here](spec/better_lock.spec.js);

### Change log

Date|Change
----|------
2018/06/04|You can now use a Number as job name
2019/09/27|Code reformat, better pattern for loading options. No feature upgrades.

### Development

Fork, then git clone. The project is already set up with a WebStorm project, if that's your cup of tee.

To run tests, with coverage:
```
npm run test
```

If you want to contribute, create a branch off master, do your work and then make a pull request against master. Unit tests would be appreciated.

## License

[MIT](./LICENSE)