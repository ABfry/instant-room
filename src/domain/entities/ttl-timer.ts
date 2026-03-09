/**
 * Timer that fires an onExpire callback after a specified duration.
 */
export class TtlTimer {
  private timerId: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor(
    private readonly durationMs: number,
    private readonly onExpire: () => void,
  ) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new RangeError(
        'TtlTimer durationMs must be a finite number greater than 0',
      )
    }
  }

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
