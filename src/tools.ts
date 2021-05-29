import { ICallback } from './types';

export function isString(val) {
  return typeof val === 'string';
}

export function isFunction(val) {
  return typeof val === 'function';
}

export function isObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function isNumber(val, includeInfinity = false, includeNaN = false) {
  if (typeof val !== 'number') {
    return false;
  }
  if (!includeInfinity && (val === Number.POSITIVE_INFINITY || val === Number.NEGATIVE_INFINITY)) {
    return false;
  }
  if (!includeNaN && isNaN(val)) {
    return false;
  }
  return true;
}

export function noop() {
  // Nothing
}

export function makeLog(name, doLog): (msg: string) => void {
  if (!doLog) {
    return noop;
  }

  if (doLog === true) {
    doLog = console.log.bind(console);
  }

  if (name) {
    name = '[' + name + '] ';
  }

  return function log(msg) {
    if (name) {
      doLog(name + msg);
    } else {
      doLog(msg);
    }
  };
}

/**
 * Create a wrapped promise + callback construct
 */
export function callbackWithPromise<TResult = any>(): Promise<TResult> & {
  callback: ICallback<TResult>;
} {
  let callback;
  const promise = new Promise((resolve, reject) => {
    callback = (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    };
  });
  callback.promise = promise;
  return callback;
}

/**
 * Assign properties from sources to target, skipping over undefined-s
 * @param target Target object which will be mutated
 * @param sources One or more source objects which will provide properties
 */
export function assign<T>(target: T, sources: T[]): T {
  for (const source of sources) {
    if (!isObject(source)) {
      // We must have an object to assign
      continue;
    }

    for (const key in source) {
      if (!source.hasOwnProperty(key)) {
        continue;
      }

      const sourceValue = source[key];
      if (sourceValue === undefined) {
        // Do not overwrite undefineds
        continue;
      }

      const targetValue = target[key];
      if (isObject(sourceValue) && isObject(targetValue)) {
        // Merge deep.
        const cloneRoot = targetValue.constructor ? new (targetValue.constructor as any)() : {};
        target[key] = assign(cloneRoot, [targetValue, sourceValue]);
        continue;
      }

      // In all other cases, copy by reference
      target[key] = sourceValue;
    }
  }

  return target;
}
