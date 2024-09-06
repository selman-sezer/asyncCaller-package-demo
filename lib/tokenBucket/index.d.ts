import type { TokenBucketOptions } from './types';
export declare class TokenBucket {
  private _tokens;
  private readonly _capacity;
  private readonly _fillPerWindow;
  private readonly _windowInMs;
  private _timerId;
  private readonly _waitQueue;
  private readonly verbose;
  private _nextRefillDate;
  private _ongoingForcedStop;
  constructor(options: TokenBucketOptions, verbose?: boolean);
  private logRemaniningTokensPeriodically;
  /**
   * Force the bucket to wait until the specified amount of seconds have passed
   * @param delayInMs How many miliseconds should be passed before the bucket is refilled
   * @returns
   */
  forceWaitUntilMilisecondsPassed(delayInMs: number): void;
  validate(options: TokenBucketOptions): void;
  /**
   * @returns Return this instance, to allow chaining
   */
  private _startInternal;
  start(): TokenBucket;
  stop(): void;
  get capacity(): number;
  get tokens(): number;
  private _addToken;
  consume(amount?: number): boolean;
  consumeAsync(amount?: number): Promise<boolean>;
  private _tryResolveWaiting;
}
