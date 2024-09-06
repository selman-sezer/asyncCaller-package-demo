import { TokenBucket } from '../tokenBucket/index';
const defaultTokenBucketOptions = {
    capacity: 10,
    fillPerWindow: 1,
    windowInMs: 100,
};
const defaultRetryOptions = {
    maxRetries: 3,
    minDelayInMs: 1000,
    maxDelayInMs: 10000,
    backoffFactor: 2,
};
/**
 * A class for making asynchronous calls with retry, concurrency, and rate limiting capabilities.
 * Creates an instance of AsyncCaller.
 * @param options - The options for configuring the AsyncCaller.
 * @param options.tokenBucketOptions - The options for configuring the rate limits.
 * @param options.tokenBucketOptions.capacity - The maximum number of requests allowed in a window.
 * @param options.tokenBucketOptions.fillPerWindow - The number of requests to allow per window. This determines the rate at which requests are allowed.
 * @param options.tokenBucketOptions.windowInMs - The size of the window in milliseconds.
 * @param options.tokenBucketOptions.initialTokens - The initial number of allowed requests. If not provided, it defaults to the capacity. Setting it to a lower value can be useful for gradually ramping up the rate.
 * @param options.retryOptions - The options for configuring the retry behavior.
 * @param options.concurrency - The maximum number of concurrent tasks allowed.
 *
 * @example
 * // Create an AsyncCaller with a simple rate limit of 10 requests per second
 * const asyncCaller = new AsyncCaller({
 *   tokenBucketOptions: {
 *     capacity: 10,
 *     fillPerWindow: 10,
 *     windowInMs: 1000,
 *   },
 * });
 *
 * @example
 * // Create an AsyncCaller with a rate limit of 100 requests per minute, with a burst capacity of 20 requests
 * const asyncCaller = new AsyncCaller({
 *   tokenBucketOptions: {
 *     capacity: 20,
 *     fillPerWindow: 100,
 *     windowInMs: 60000,
 *   },
 * });
 */
export class AsyncCaller {
    _tokenBucket;
    _retryOptions;
    _concurrency;
    runningTasks = 0;
    queue;
    verbose;
    constructor(options, verbose = false) {
        this.verbose = verbose;
        this._tokenBucket = new TokenBucket(options?.tokenBucketOptions ?? defaultTokenBucketOptions, this.verbose);
        this._retryOptions = options?.retryOptions ?? defaultRetryOptions;
        this._concurrency = options?.concurrency ?? 5;
        this.queue = [];
    }
    async call(fn) {
        await new Promise((resolve) => {
            this.queue.push(resolve);
            this.processTaskQueue();
        });
        return await this.executeAndHandleErrors(fn);
    }
    processTaskQueue() {
        while (this.runningTasks < this._concurrency && this.queue.length > 0) {
            this.runningTasks++;
            const resolve = this.queue.shift();
            if (resolve) {
                if (this.verbose)
                    console.log(`AsyncCaller: Running task... Concurrency: (${this.runningTasks} / ${this._concurrency}) (Queue length: ${this.queue.length})`);
                resolve();
            }
        }
    }
    async extractErrorMessageFromResponse(response) {
        try {
            const fetchResponse = response;
            const json = await fetchResponse.json();
            if (json.error)
                return JSON.stringify(json.error);
            if (json.message)
                return json.message;
            if (json.error_message)
                return json.error_message;
            if (json.errors)
                return JSON.stringify(json.errors);
            else
                return undefined;
        }
        catch (e) {
            return undefined;
        }
    }
    async executeWithRetry(fn, tryCount = 1, lastResponse = undefined, lastError = undefined) {
        let directlyReturnErrorAsResult = false;
        while (!(await this._tokenBucket.consumeAsync()))
            ;
        if (tryCount > this._retryOptions.maxRetries + 1) {
            if (this.verbose)
                console.log('AsyncCaller: Max retries exceeded. Rejecting...');
            let errorToThrow = new Error('Max retries exceeded.');
            if (lastError)
                errorToThrow = lastError;
            else if (lastResponse) {
                const errorText = await this.extractErrorMessageFromResponse(lastResponse);
                if (errorText)
                    errorToThrow = new Error(errorText);
            }
            throw errorToThrow;
        }
        return fn()
            .then(async (result) => {
            const fetchResult = result;
            if (this.isRateLimitedError(fetchResult)) {
                const delay = this.calculateRetryDelay(tryCount, fetchResult.headers);
                // eslint-disable-next-line promise/param-names
                await new Promise((innerResolve) => setTimeout(() => {
                    innerResolve();
                }, delay));
                return this.executeWithRetry(fn, tryCount + 1, fetchResult, lastError);
            }
            else if (this.isClientSideError(fetchResult)) {
                directlyReturnErrorAsResult = true;
                throw result;
            }
            else
                return result;
        })
            .catch(async (err) => {
            if (directlyReturnErrorAsResult)
                return err;
            // if the error is thrown deliberetly in the previous block, rethrow it)
            if (tryCount === this._retryOptions.maxRetries + 1) {
                if (this.verbose)
                    console.log('AsyncCaller: Max retries exceeded. Rejecting...');
                throw err;
            }
            else if (this.isRateLimitedError(err)) {
                const delay = this.calculateRetryDelay(tryCount, err.headers ?? err.response?.headers);
                // eslint-disable-next-line promise/param-names
                await new Promise((innerResolve) => setTimeout(() => {
                    innerResolve();
                }, delay));
                return this.executeWithRetry(fn, tryCount + 1, lastResponse, err);
            }
            else if (this.isClientSideError(err))
                throw err;
            else {
                const delay = this.calculateDefaultDelay(tryCount);
                // eslint-disable-next-line promise/param-names
                await new Promise((innerResolve) => setTimeout(() => {
                    innerResolve();
                }, delay));
                return this.executeWithRetry(fn, tryCount + 1, err);
            }
        });
    }
    async executeAndHandleErrors(fn) {
        try {
            const result = await this.executeWithRetry(fn, 1, undefined);
            return result;
        }
        finally {
            this.runningTasks--;
            this.processTaskQueue();
        }
    }
    isClientSideError(errOrResponse) {
        const possibleProperties = this.extractStatusCodeProperties(errOrResponse);
        for (const property of possibleProperties) {
            if (property >= 400 && property < 500) {
                if (this.verbose) {
                    console.log(`AsyncCaller: Client side error detected. Status code: ${property}`);
                    console.log(JSON.stringify(errOrResponse));
                }
                return true;
            }
        }
        return false;
    }
    isRateLimitedError(errOrResponse) {
        const possibleProperties = this.extractStatusCodeProperties(errOrResponse);
        for (const property of possibleProperties) {
            if (property === 429) {
                if (this.verbose)
                    console.log('AsyncCaller: Too many requests detected.');
                return true;
            }
        }
        return false;
    }
    extractStatusCodeProperties(err) {
        const statusCodes = [
            err?.status,
            err?.response?.status,
            err?.statuscode,
            err?.response?.statuscode,
        ];
        return statusCodes.filter((status) => typeof status === 'number' && !Number.isNaN(status));
    }
    calculateRetryDelay(completedTryCount, headers) {
        // check if headers has a get function
        if (headers) {
            let retryAfterHeader;
            if (typeof headers.get === 'function')
                retryAfterHeader = headers.get('Retry-After');
            else
                retryAfterHeader = headers['Retry-After'];
            if (retryAfterHeader) {
                const delay = Number.parseInt(retryAfterHeader) * 1000; // Convert seconds to milliseconds
                if (!Number.isNaN(delay)) {
                    this._tokenBucket.forceWaitUntilMilisecondsPassed(delay);
                    return delay;
                }
                else if (Date.parse(retryAfterHeader) > 0) {
                    const now = new Date().getTime();
                    const retryAfter = new Date(retryAfterHeader).getTime();
                    const delay = Math.max(retryAfter - now, 0);
                    this._tokenBucket.forceWaitUntilMilisecondsPassed(delay);
                    return delay;
                }
                else {
                    // If the Retry-After header value cannot be parsed, fall back to the default back-off strategy
                    return this.calculateDefaultDelay(completedTryCount);
                }
            }
            else
                return this.calculateDefaultDelay(completedTryCount);
        }
        else {
            // If no specific Retry-After header is found, use the default back-off strategy
            return this.calculateDefaultDelay(completedTryCount);
        }
    }
    calculateDefaultDelay(completedTryCount) {
        // Exponential back-off strategy based on the RetryOptions
        const delay = Math.min(this._retryOptions.minDelayInMs *
            this._retryOptions.backoffFactor ** (completedTryCount - 1), this._retryOptions.maxDelayInMs);
        return delay;
    }
}
