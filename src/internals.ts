import { ILockJobOptions } from './options';
import { ICallback, IExecutor } from './types';

/**
 * Class that represents one scheduled job and its state. This is created every time user calls "acquire"
 */
export class LockJob<TResult> {
  static _lastId = 0;

  /** ID to uniquely identify this particular job */
  public id = undefined;

  /**
   * List of keys that will be locked. Always an array
   */
  public keys: Array<string | null>;

  /**
   * Number of keys which this job is waiting on. Once this reaches 0, job will be executed
   */
  public waiting_count: number;

  /**
   * Function that will be called inside the lock
   */
  public executor: IExecutor<TResult>;

  /**
   * Function that will be called once job is done, whether it succeeds or times out.
   * This is supplied by user in callback API, and generated internally otherwise.
   */
  public callback: ICallback<TResult>;

  /**
   * Timestamp when job was created
   */
  public enqueued_at: Date = new Date();

  /**
   * Timestamp when job was executed
   */
  public executed_at: Date = null;

  /**
   * This is set when job ends, in case something holds a reference to it
   */
  public ended_at: Date = null;

  /**
   * Options that apply to this particular job
   */
  public options: ILockJobOptions;

  /**
   * Id of the wait timer
   */
  public wait_timeout_id = null;

  /**
   * Id of the execution timer
   */
  public execution_timeout_id = null;

  /**
   * Saved incoming stack, for the purpose of extending stack traces
   */
  public incoming_stack: string = null;

  constructor(
    keys: Array<string | null>,
    executor: IExecutor<TResult>,
    callback: ICallback<TResult>,
    options: ILockJobOptions
  ) {
    LockJob._lastId++;
    this.id = LockJob._lastId;
    this.keys = keys;
    this.waiting_count = keys.length;
    this.executor = executor;
    this.callback = callback;
    this.options = options;
  }

  toString() {
    return `Job #${this.id} [${this.keys.join(', ')}]`;
  }
}

// *********************************************************************************************************************

/**
 * Class to hold pending, holding and executing jobs for one key
 */
export class KeyQueue {
  // We will use this key when user doesn't supply anything
  static readonly DEFAULT_QUEUE_KEY = '___DEFAULT_QUEUE_KEY___';

  public key: string;

  /**
   * Queue of jobs waiting to be executed.
   * Jobs in this state are governed by the wait_timeout.
   */
  public jobs: LockJob<any>[] = [];

  /**
   * Active job that is holding this key. This job could be waiting on other keys or executing.
   */
  public active: LockJob<any> = null;

  constructor(key?: string) {
    this.key = key;
  }

  toString() {
    return this.key === KeyQueue.DEFAULT_QUEUE_KEY ? 'JobQueue' : `JobQueue<${this.key}>`;
  }
}
