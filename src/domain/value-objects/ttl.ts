import ms from 'ms'

/**
 * Parse a TTL value into milliseconds.
 * Accepts a human-readable string ('2h', '30m') or a number (milliseconds).
 */
export function parseTtl(ttl: string | number): number {
  if (typeof ttl === 'number') {
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error(`Invalid TTL value: ${ttl}`)
    }
    return ttl
  }

  const parsed = ms(ttl as ms.StringValue)
  if (parsed === undefined) {
    throw new Error(`Invalid TTL string: ${ttl}`)
  }
  return parsed
}

/**
 * Timer that fires an onExpire callback after a specified duration.
 */
export class TtlTimer {
  private timerId: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor(
    private readonly durationMs: number,
    private readonly onExpire: () => void,
  ) {}

  /** Whether the timer is currently running */
  get isRunning(): boolean {
    return this.timerId !== null
  }

  /** Start the timer */
  start(): void {
    if (this.destroyed) return
    if (this.timerId !== null) return
    this.timerId = setTimeout(() => {
      this.timerId = null
      this.onExpire()
    }, this.durationMs)
  }

  /** Reset the timer */
  reset(): void {
    if (this.destroyed) return
    this.clear()
    this.start()
  }

  /** Stop the timer (can be restarted) */
  stop(): void {
    this.clear()
  }

  /** Permanently destroy the timer */
  destroy(): void {
    this.clear()
    this.destroyed = true
  }

  private clear(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }
}
