import { KeyQueue, LockJob } from './internals';
import { IErrorName } from './types';

export class BetterLockError extends Error {
  /**
   * Name of the lock that caused the error
   */
  lock_name: string;

  /**
   * Error name, maps to error's class name. Eg. BetterLockError.
   */
  name: IErrorName;

  constructor(lockName, message, incomingStack = null) {
    // Fix typescript custom Error prototype chain
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    // https://github.com/reduardo7/ts-base-error/blob/master/src/index.ts
    const trueProto = new.target.prototype;

    if (lockName) {
      super(`[${lockName}] ${message}`);
    } else {
      super(message);
    }

    Object.setPrototypeOf(this, trueProto);

    this.lock_name = lockName;
    this.name = this.constructor.name as IErrorName;

    if (incomingStack) {
      const withoutFirstLine = incomingStack.split('\n').slice(1).join('\n');
      this.stack =
        this.stack +
        '\n    --------------------------------------------------------------------------------\n' +
        withoutFirstLine;
    }
  }
}

export class BetterLockInternalError extends BetterLockError {
  constructor(lockName, message) {
    const lastChar = message[message.length - 1];
    if (lastChar !== '.' && lastChar !== '!' && lastChar !== '?') {
      message += '.';
    }
    super(lockName, message + ' This is probably a bug inside "better-lock" library');
  }
}

export class BetterLockInvalidArgumentError extends BetterLockError {
  constructor(lockName, public argument, expected, actual) {
    super(lockName, `Argument "${argument}" must be ${expected} (got: "${actual}")`);
    this.argument = argument;
  }
}

export class BetterLockWaitTimeoutError extends BetterLockError {
  public job_id: number;
  public keys: string[];
  public enqueued_at: Date;

  constructor(lockName, job: LockJob<any>) {
    const message = `${job} has timed out after ${
      new Date().valueOf() - job.enqueued_at.valueOf()
    }ms in wait queue`;

    super(lockName, message, job.incoming_stack);

    this.job_id = job.id;
    this.keys = job.keys;
    this.enqueued_at = job.enqueued_at;
  }
}

export class BetterLockExecutionTimeoutError extends BetterLockError {
  public job_id: number;
  public keys: string[];
  public executed_at: Date;

  constructor(lockName, job: LockJob<any>) {
    const message = `${job} has timed out after ${
      new Date().valueOf() - job.executed_at.valueOf()
    }ms of execution`;

    super(lockName, message, job.incoming_stack);

    this.job_id = job.id;
    this.keys = job.keys;
    this.executed_at = job.executed_at;
  }
}

export class BetterLockQueueOverflowError extends BetterLockError {
  public job_id: number;
  public keys: string[];
  public job_count: number;
  public kicked_out_job_id: number;

  constructor(lockName, key, count, job: LockJob<any>) {
    const keyDesignation = key === KeyQueue.DEFAULT_QUEUE_KEY ? '' : ` for key "${key}"`;
    const message = `Too many jobs (${count}) are waiting${keyDesignation}. The most recent job (${job}) was kicked out`;

    super(lockName, message, job.incoming_stack);

    this.job_id = job.id;
    this.keys = job.keys;
    this.job_count = count;
    this.kicked_out_job_id = job.id;
  }
}

export class BetterLockJobAbortedError extends BetterLockError {
  public job_id: number;
  public keys: string[];

  constructor(lockName, job) {
    super(lockName, `${job} has been aborted by the user`, job.incoming_stack);

    this.job_id = job.id;
    this.keys = job.keys;
  }
}
