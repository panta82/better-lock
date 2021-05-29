import {
  BetterLockInternalError,
  ExecutionTimeoutError,
  InvalidArgumentError,
  JobAbortedError,
  QueueOverflowError,
  WaitTimeoutError,
} from './errors';
import { BetterLockOptions, LockJobOptions } from './options';
import * as tools from './tools';
import {
  ICallback,
  ICallbackExecutor,
  ILockKey,
  IPromiseExecutor,
  KeyQueue,
  LockJob,
} from './types';

/**
 * Create a better lock object.
 */
export class BetterLock {
  /**
   * Default options to be used when creating BetterLock instances.
   */
  static DEFAULT_OPTIONS = new BetterLockOptions({
    extend_stack_traces: true,
    promise_tester: p => p && typeof p.then === 'function',
  });

  private options: BetterLockOptions;
  private log: (msg: string) => void;
  private queues: { [key: string]: KeyQueue };

  constructor(options?: Partial<BetterLockOptions>) {
    this.options = new BetterLockOptions([BetterLock.DEFAULT_OPTIONS, options]);
    this.log = tools.makeLog(this.options.name, this.options.log);
    this.queues = {};
  }

  /**
   * Return or create a key queue for given key
   */
  private getQueue(key: ILockKey): KeyQueue {
    if (key === undefined || key === null) {
      key = KeyQueue._defaultQueueKey;
    }
    let queue = this.queues[key];
    if (!queue) {
      queue = this.queues[key] = new KeyQueue(String(key));
    }
    return queue;
  }

  /**
   * Returns true if the caller can *immediately* acquire the lock. There is nothing holding the key and nothing in the queue.
   */
  public canAcquire(key?: string): boolean {
    const queue = this.getQueue(key);
    return !queue.active && !queue.jobs.length;
  }

  private normalizeAndValidateKey(key: ILockKey) {
    if (key === undefined) {
      return null;
    }
    if (key === null) {
      return null;
    }
    if (tools.isString(key)) {
      return key;
    }
    if (tools.isNumber(key)) {
      return String(key);
    }
    // Invalid key value
    throw new InvalidArgumentError(
      this.options.name,
      'key',
      'an instance of ILockKey: string, number, undefined or null',
      key
    );
  }

  public acquire<TResult>(
    executor: IPromiseExecutor<TResult>,
    jobOptions?: LockJobOptions
  ): Promise<TResult>;
  public acquire<TResult>(
    executor: ICallbackExecutor<TResult>,
    callback?: ICallback<TResult>,
    jobOptions?: LockJobOptions
  ): void;
  public acquire<TResult>(
    key: ILockKey | Array<ILockKey>,
    executor: IPromiseExecutor<TResult>,
    jobOptions?: LockJobOptions
  ): Promise<TResult>;
  public acquire<TResult>(
    key: ILockKey | Array<ILockKey>,
    executor: ICallbackExecutor<TResult>,
    callback?: ICallback<TResult>,
    jobOptions?: LockJobOptions
  ): undefined;
  /**
   * Acquire the lock for given key or list of keys. If waiting on a list, keys will be acquired in order,
   * as they become free. Any deadlock prevention must be handled by the caller.
   *
   * Once the lock is acquired, we will call the executor function, with a "done" method.
   * You must call "done" to release the lock. Alternatively, return a Promise; lock will be released
   * once promise resolves or rejects.
   *
   * Return values from your executor will be passed to callback (or the resulting promise).
   *
   * @param key Named key or array of keys for this particular call. Calls with different keys will be run in parallel. Not required.
   * @param executor Function that will run inside the lock. Required.
   * @param callback Function to be called after the executor finishes or if we never enter the lock (timeout, queue depletion). Leave out to use promises.
   * @param jobOptions Options to be applied on this job only
   */
  public acquire(key, executor?, callback?, jobOptions?) {
    if (tools.isFunction(key) || tools.isObject(key)) {
      // Presume we weren't given a key (first form)
      jobOptions = callback;
      callback = executor;
      executor = key;
      key = null;
    }

    // Repackage "key" into an array of keys
    const keys = [];
    if (Array.isArray(key)) {
      const arrayOfKeys = key;
      // Make sure we don't add duplicates
      const seenKeys = new Set();
      for (let i = 0; i < arrayOfKeys.length; i++) {
        const normalizedKey = this.normalizeAndValidateKey(arrayOfKeys[i]);
        if (!seenKeys.has(normalizedKey)) {
          keys.push(normalizedKey);
          seenKeys.add(normalizedKey);
        }
      }
    } else {
      keys.push(this.normalizeAndValidateKey(key));
    }

    // Create callback wrapper for promise interface
    if (!tools.isFunction(callback)) {
      if (jobOptions === undefined) {
        jobOptions = callback;
      }

      callback = tools.callbackWithPromise();
    }

    // Validate other options
    if (!tools.isFunction(executor)) {
      throw new InvalidArgumentError(this.options.name, 'executor', 'a function', executor);
    }
    if (!tools.isFunction(callback)) {
      throw new InvalidArgumentError(this.options.name, 'callback', 'a function', callback);
    }

    // Prepare job options
    const effectiveJobOptions = jobOptions
      ? new LockJobOptions([this.options, jobOptions])
      : // No need to create new object since these will be read-only and are subset of global options
        this.options;

    const job = new LockJob(keys, executor, callback, effectiveJobOptions);

    // Set incoming stack
    if (effectiveJobOptions.extend_stack_traces) {
      const tempErr = new Error();
      Error.captureStackTrace(tempErr, this.acquire);
      job.incoming_stack = tempErr.stack;
    }

    // Add job to its key queues
    const queuesToUpdate = [];
    for (let i = 0; i < keys.length; i++) {
      const queue = this.getQueue(keys[i]);
      queue.jobs.push(job);
      queuesToUpdate.push(queue);
    }

    // Start wait timer, if enabled
    if (tools.isNumber(job.options.wait_timeout)) {
      job.wait_timeout_id = setTimeout(() => this.onWaitTimeout(job), job.options.wait_timeout);

      // NOTE: timeout of 0 will NOT trigger error if lock can be acquired immediately.
    }

    this.log(`Enqueued ${job}`);

    // Perform update of queues this job has modified. We don't do this in next tick or something,
    // because we want canAcquire to immediately return false
    if (queuesToUpdate.length) {
      this.update(queuesToUpdate);
    } else {
      // Special case. We are given empty list of keys. We will immediately execute jobs like this.
      this.executeJob(job);
    }

    return (callback as any).promise;
  }

  /**
   * Update state of given list of queues.
   */
  private update(queues: KeyQueue[]) {
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i];

      // If key is available, have next job grab it
      if (!queue.active && queue.jobs.length) {
        const job = queue.jobs.splice(0, 1)[0];
        queue.active = job;
        job.waiting_count--;

        if (job.waiting_count <= 0) {
          // This job can be executed now.
          this.executeJob(job);
        }
      }

      // Handle wait queue overflow
      if (tools.isNumber(this.options.queue_size) && this.options.queue_size < queue.jobs.length) {
        // Overflow. Reject the most recent job
        const mostRecentJob = queue.jobs[queue.jobs.length - 1];
        this.log(
          `${queue.toString()} has overflown, so most recent job (${mostRecentJob}) was kicked out`
        );

        this.endJob(mostRecentJob, [
          new QueueOverflowError(this.options.name, queue.key, queue.jobs.length, mostRecentJob),
        ]);
      }
    }
  }

  private executeJob(job: LockJob<any>) {
    this.log(`Executing ${job}`);

    // Clear wait timeout
    clearTimeout(job.wait_timeout_id);
    job.wait_timeout_id = null;

    // We want to do the rest of this in a separate context, because we don't want user executor code
    // to ever interfere with the code calling acquire().

    setImmediate(() => {
      // Make sure job hasn't been ended in the meantime
      if (job.executed_at || job.ended_at) {
        return;
      }

      // Validate this job is holding all queues it needs
      for (let i = 0; i < job.keys.length; i++) {
        const queue = this.getQueue(job.keys[i]);
        if (queue.active !== job) {
          // This should never happen
          return this.endJob(job, [
            new BetterLockInternalError(
              this.options.name,
              `Corrupted wait queue state for ${queue.key}`
            ),
          ]);
        }
      }

      // Mark job as having started executing
      job.executed_at = new Date();

      if (tools.isNumber(job.options.execution_timeout)) {
        job.execution_timeout_id = setTimeout(
          () => this.onExecutionTimeout(job),
          job.options.execution_timeout
        );
      }

      const lockDone = (...args) => {
        this.log(`Done called for ${job}`);

        this.endJob(job, args);
      };

      if (job.executor.length > 0) {
        // Callback interface
        job.executor(lockDone);
        return;
      }

      // Promise interface
      let executorResult;
      try {
        executorResult = (job.executor as any)();
      } catch (err) {
        // Error thrown directly from executor
        lockDone(err);
      }

      // Promise sniffing
      if (this.options.promise_tester(executorResult)) {
        executorResult.then(
          res => lockDone(null, res),
          err => lockDone(err)
        );
      } else {
        // "promise" is just some random value. We don't have to wait
        lockDone(null, executorResult);
      }
    });
  }

  private onWaitTimeout(job: LockJob<any>) {
    this.log(
      `${job} has timed out after waiting in queue for ${
        new Date().valueOf() - job.enqueued_at.valueOf()
      }ms`
    );

    this.endJob(job, [new WaitTimeoutError(this.options.name, job)]);
  }

  private onExecutionTimeout(job: LockJob<any>) {
    this.log(
      `${job} has timed out after executing for ${
        new Date().valueOf() - job.executed_at.valueOf()
      }ms`
    );

    this.endJob(job, [new ExecutionTimeoutError(this.options.name, job)]);
  }

  private endJob(job: LockJob<any>, callbackArgs: any[]) {
    if (job.ended_at) {
      this.log(
        `WARNING: ${job} is trying to end, but it has already ended at ${job.ended_at.toISOString()}. Called with arguments: ${callbackArgs}`
      );
      return;
    }

    clearTimeout(job.wait_timeout_id);
    job.wait_timeout_id = null;

    clearTimeout(job.execution_timeout_id);
    job.execution_timeout_id = null;

    job.ended_at = new Date();

    const queuesToUpdate = [];
    for (let i = 0; i < job.keys.length; i++) {
      const queue = this.getQueue(job.keys[i]);
      queuesToUpdate.push(queue);

      if (queue.active === job) {
        // This job was holding on the queue's key
        queue.active = null;
      } else {
        // This job was still in wait list for this queue
        const index = queue.jobs.indexOf(job);
        if (index >= 0) {
          // Remove from queue
          queue.jobs.splice(index, 1);
        } else {
          // Something is wrong. Where did this job come from?
          this.log(
            `WARNING: ${job} is ending, but it is not found anywhere in the queue for ${queue.key}`
          );
        }
      }
    }

    // Call the callback
    try {
      job.callback.apply(null, callbackArgs);
    } finally {
      // Whatever happens, schedule a queue update
      setImmediate(() => this.update(queuesToUpdate));
    }
  }

  /**
   * Abort all jobs for a given key (or from the default job queue, if no key is given).
   * Job executors will not be called. Callbacks will be called with JobAbortedError.
   * Currently executing job will not be interrupted.
   * @param [key]
   */
  public abort(key: ILockKey) {
    const queue = this.getQueue(key);
    queue.jobs.slice().forEach(job => {
      this.endJob(job, [new JobAbortedError(this.options.name, job)]);
    });
    if (queue.active && !queue.active.executed_at) {
      // If we have a job holding this queue that hasn't been executed yet, abort it as well
      this.endJob(queue.active, [new JobAbortedError(this.options.name, queue.active)]);
    }
  }

  /**
   * Abort all pending jobs from all queues.
   * Currently executing jobs will not be interrupted.
   */
  public abortAll() {
    this.abort(null);
    for (const key in this.queues) {
      // noinspection JSUnfilteredForInLoop
      this.abort(key);
    }
  }
}
