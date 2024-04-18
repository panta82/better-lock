import * as errors from './errors';

type IErrorExports = typeof errors;

/**
 * All error names that we can emit
 */
export type IErrorName = keyof IErrorExports;

/**
 * User-supplied callback. We support a "canonical" callback, with just error and result,
 * but also old-school callbacks, with varargs return values.
 */
export type ICallback<TResult> = TResult extends any[]
  ? (err: Error | null, ...result: TResult) => void
  : (err: Error | null, result?: TResult) => void;

/**
 * Function that user will supply as the thing that will be running inside lock.
 * It can either accept a done() function, or return a promise.
 */
export type ICallbackExecutor<TResult> = (lockDone: ICallback<TResult>) => void;
export type IPromiseExecutor<TResult> = () => Promise<TResult>;
export type IExecutor<TResult> = ICallbackExecutor<TResult> | IPromiseExecutor<TResult>;

/**
 * Key types that can be used for a lock.
 */
export type ILockKey = string | number | null | undefined;
