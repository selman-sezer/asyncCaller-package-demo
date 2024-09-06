export declare enum TimeUnit {
    Milliseconds = 1,
    Seconds = 1000,
    Minutes = 60000,
    Hours = 3600000,
    Days = 86400000
}
export interface RetryOptions {
    /**
     * The maximum number of retries. Default is 3.
     */
    maxRetries?: number;
    /**
     * The minimum delay between retries in milliseconds. Default is 1000.
     */
    minDelayInMs?: number;
    /**
     * The maximum delay between retries in milliseconds. Default is 10000
     */
    maxDelayInMs?: number;
    /**
     * The factor by which the delay should be increased after each retry. Default is 2.
     */
    backoffFactor?: number;
}
//# sourceMappingURL=types.d.ts.map