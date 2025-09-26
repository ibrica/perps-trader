export class TimeoutError extends Error {
  readonly type = TimeoutError.name;

  constructor(message = 'Timeout') {
    super(message);
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export const isTimeoutError = (err: unknown): err is TimeoutError => {
  return err instanceof TimeoutError;
};

/**
 * The following utility function takes a promise as callback.
 * It will run the promise until the promise itself completes.
 * However, if the timeout reaches before the completion of the promise,
 * the code implementing it will throw a TimeoutError.
 * @param cb - The callback to run
 * @param timeoutSec - The promise will resolve after this time, however the callback will still run in the background
 * @param error - The error to throw on timeout @default TimeoutError
 * */
export const timedPromise = <T>(
  cb: () => Promise<T>,
  timeoutSec: number,
  error = new TimeoutError(),
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(error);
    }, timeoutSec * 1000);

    cb().then((result) => {
      clearTimeout(timeout);
      resolve(result);
    });
  });
};
