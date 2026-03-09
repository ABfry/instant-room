import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseTtl, TtlTimer } from '../../../src/domain/value-objects/ttl.js'

describe('parseTtl', () => {
  it('parses "2h" to milliseconds', () => {
    expect(parseTtl('2h')).toBe(7_200_000)
  })

  it('parses "30m" to milliseconds', () => {
    expect(parseTtl('30m')).toBe(1_800_000)
  })

  it('parses "1d" to milliseconds', () => {
    expect(parseTtl('1d')).toBe(86_400_000)
  })

  it('returns number as-is', () => {
    expect(parseTtl(60000)).toBe(60000)
  })

  it('throws on invalid string', () => {
    expect(() => parseTtl('invalid')).toThrow('Invalid TTL string')
  })

  it('throws on negative number', () => {
    expect(() => parseTtl(-1000)).toThrow('Invalid TTL value')
  })

  it('throws on zero', () => {
    expect(() => parseTtl(0)).toThrow('Invalid TTL value')
  })

  it('throws on NaN', () => {
    expect(() => parseTtl(NaN)).toThrow('Invalid TTL value')
  })
})

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
