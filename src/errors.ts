import { LockJob } from './types';

export class BetterLockError extends Error {
  /**
   * Name of the lock that caused the error
   */
  lock_name: string;

  constructor(name, message, incomingStack = null) {
    if (name) {
      super(`[${name}] ${message}`);
    } else {
      super(message);
    }
    this.lock_name = name;

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
  constructor(name, message) {
    const lastChar = message[message.length - 1];
    if (lastChar !== '.' && lastChar !== '!' && lastChar !== '?') {
      message += '.';
    }
    super(name, message + ' This is probably a bug inside "better-lock" library');
  }
}

export class InvalidArgumentError extends BetterLockError {
  constructor(name, public argument, expected, actual) {
    super(name, `Argument "${argument}" must be ${expected} (got: "${actual}")`);
    this.argument = argument;
  }
}

export class WaitTimeoutError extends BetterLockError {
  public job_id: number;
  public keys: string[];
  public enqueued_at: Date;

  constructor(name, job: LockJob<any>) {
    const message = `${job} has timed out after ${
      new Date().valueOf() - job.enqueued_at.valueOf()
    }ms in wait queue`;

    super(name, message, job.incoming_stack);

    this.job_id = job.id;
    this.keys = job.keys;
    this.enqueued_at = job.enqueued_at;
  }
}

export class ExecutionTimeoutError extends BetterLockError {
  public job_id: number;
  public keys: string[];
  public executed_at: Date;

  constructor(name, job: LockJob<any>) {
    const message = `${job} has timed out after ${
      new Date().valueOf() - job.executed_at.valueOf()
    }ms of execution`;

    super(name, message, job.incoming_stack);

    this.job_id = job.id;
    this.keys = job.keys;
    this.executed_at = job.executed_at;
  }
}

export class QueueOverflowError extends BetterLockError {
  public job_id: number;
  public keys: string[];
  public job_count: number;
  public kicked_out_job_id: number;

  constructor(name, key, count, job: LockJob<any>) {
    const message = `Too many jobs (${count}) waiting for ${key}. The most recent job (${job}) was kicked out`;

    super(name, message, job.incoming_stack);

    this.job_id = job.id;
    this.keys = job.keys;
    this.job_count = count;
    this.kicked_out_job_id = job.id;
  }
}

export class JobAbortedError extends BetterLockError {
  public job_id: number;
  public keys: string[];

  constructor(name, job) {
    super(name, `${job} has been aborted by the user`, job.incoming_stack);

    this.job_id = job.id;
    this.keys = job.keys;
  }
}
