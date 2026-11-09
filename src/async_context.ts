/**
 * The subset of Node.js AsyncResource we use. Declared locally, so the package (and its type declarations)
 * don't depend on Node.js types and keep working in browsers.
 */
export interface IAsyncResource {
  runInAsyncScope<TResult>(fn: (...args: any[]) => TResult, thisArg?: any, ...args: any[]): TResult;
}

interface IAsyncHooksModule {
  AsyncResource: new (type: string) => IAsyncResource;
}

/**
 * Look up Node.js async_hooks at runtime, without a static import, so bundlers and browsers never see it.
 * Requires Node.js 20.16+ or 22.3+. Returns undefined everywhere else.
 */
function lookupAsyncHooks(): IAsyncHooksModule | undefined {
  try {
    const asyncHooks = (globalThis as any).process?.getBuiltinModule?.('node:async_hooks');
    if (asyncHooks && typeof asyncHooks.AsyncResource === 'function') {
      return asyncHooks;
    }
  } catch (err) {
    // Unsupported runtime
  }
  return undefined;
}

const asyncHooks = lookupAsyncHooks();

/**
 * Capture the current async context, so a job can later run in it. Undefined if the runtime doesn't support it.
 */
export function captureAsyncContext(): IAsyncResource | undefined {
  return asyncHooks ? new asyncHooks.AsyncResource('BetterLock') : undefined;
}
