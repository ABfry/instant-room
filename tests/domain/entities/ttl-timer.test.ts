import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TtlTimer } from '../../../src/domain/entities/ttl-timer.js'

describe('TtlTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires onExpire after duration', () => {
    const onExpire = vi.fn()
    const timer = new TtlTimer(1000, onExpire)

    timer.start()
    expect(onExpire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('does not fire before duration', () => {
    const onExpire = vi.fn()
    const timer = new TtlTimer(1000, onExpire)

    timer.start()
    vi.advanceTimersByTime(999)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('reset restarts the timer', () => {
    const onExpire = vi.fn()
    const timer = new TtlTimer(1000, onExpire)

    timer.start()
    vi.advanceTimersByTime(800)
    timer.reset()
    vi.advanceTimersByTime(800)
    expect(onExpire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('stop prevents expiry', () => {
    const onExpire = vi.fn()
    const timer = new TtlTimer(1000, onExpire)

    timer.start()
    vi.advanceTimersByTime(500)
    timer.stop()
    vi.advanceTimersByTime(1000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('can restart after stop', () => {
    const onExpire = vi.fn()
    const timer = new TtlTimer(1000, onExpire)

    timer.start()
    timer.stop()
    timer.start()
    vi.advanceTimersByTime(1000)
    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('destroy prevents restart', () => {
    const onExpire = vi.fn()
    const timer = new TtlTimer(1000, onExpire)

    timer.start()
    timer.destroy()
    timer.start()
    vi.advanceTimersByTime(1000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('isRunning reflects timer state', () => {
    const timer = new TtlTimer(1000, vi.fn())

    expect(timer.isRunning).toBe(false)
    timer.start()
    expect(timer.isRunning).toBe(true)
    timer.stop()
    expect(timer.isRunning).toBe(false)
  })
})
