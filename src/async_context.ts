import { LockJob } from './internals';

/**
 * The subset of Node.js AsyncResource we use. Declared locally, so the package (and its type declarations)
 * don't depend on Node.js types and keep working in browsers.
 */
export interface IAsyncResource {
  runInAsyncScope<TResult>(fn: (...args: any[]) => TResult, thisArg?: any, ...args: any[]): TResult;
}

/**
 * The subset of Node.js AsyncLocalStorage we use.
 */
interface IAsyncLocalStorage<TStore> {
  getStore(): TStore | undefined;
  run<TResult>(store: TStore, fn: () => TResult): TResult;
}

interface IAsyncHooksModule {
  AsyncResource: new (type: string) => IAsyncResource;
  AsyncLocalStorage: new <TStore>() => IAsyncLocalStorage<TStore>;
}

/**
 * Jobs whose executors are currently running, in the current async context. Jobs from all lock instances
 * share one list; a job only ever matches the queues of the lock that created it.
 */
type IHeldJobs = ReadonlyArray<LockJob<any>>;

/**
 * Look up Node.js async_hooks at runtime, without a static import, so bundlers and browsers never see it.
 * Requires Node.js 20.16+ or 22.3+. Returns undefined everywhere else.
 */
function lookupAsyncHooks(): IAsyncHooksModule | undefined {
  try {
    const asyncHooks = (globalThis as any).process?.getBuiltinModule?.('node:async_hooks');
    if (
      asyncHooks &&
      typeof asyncHooks.AsyncResource === 'function' &&
      typeof asyncHooks.AsyncLocalStorage === 'function'
    ) {
      return asyncHooks;
    }
  } catch (err) {
    // Unsupported runtime
  }
  return undefined;
}

const asyncHooks = lookupAsyncHooks();

const lockContext: IAsyncLocalStorage<IHeldJobs> | undefined = asyncHooks
  ? new asyncHooks.AsyncLocalStorage<IHeldJobs>()
  : undefined;

/**
 * Capture the current async context, so a job can later run in it. Undefined if the runtime doesn't support it.
 */
export function captureAsyncContext(): IAsyncResource | undefined {
  return asyncHooks ? new asyncHooks.AsyncResource('BetterLock') : undefined;
}

/**
 * Jobs that are executing in the current async context (the caller is inside their executors).
 * Ended jobs can still be listed here (eg. detached work that outlived its job), so check `ended_at`.
 */
export function getHeldJobs(): IHeldJobs | undefined {
  return lockContext ? lockContext.getStore() : undefined;
}

/**
 * Run fn with the given job added to the jobs held in the current async context.
 */
export function runHoldingJob<TResult>(job: LockJob<any>, fn: () => TResult): TResult {
  if (!lockContext) {
    return fn();
  }
  return lockContext.run(withHeldJob(lockContext.getStore(), job), fn);
}

function withHeldJob(heldJobs: IHeldJobs | undefined, job: LockJob<any>): IHeldJobs {
  // Drop ended jobs, so the list doesn't grow when each executor schedules the next acquire
  const result = heldJobs ? heldJobs.filter(heldJob => !heldJob.ended_at) : [];
  result.push(job);
  return result;
}
