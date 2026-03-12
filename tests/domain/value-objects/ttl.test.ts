import { describe, it, expect } from 'vitest'
import { Ttl } from '../../../src/domain/value-objects/ttl.js'

describe('Ttl', () => {
  describe('fromString', () => {
    it('parses "2h" to milliseconds', () => {
      expect(Ttl.fromString('2h').toMs()).toBe(7_200_000)
    })

    it('parses "30m" to milliseconds', () => {
      expect(Ttl.fromString('30m').toMs()).toBe(1_800_000)
    })

    it('parses "1d" to milliseconds', () => {
      expect(Ttl.fromString('1d').toMs()).toBe(86_400_000)
    })

    it('throws on invalid string', () => {
      expect(() => Ttl.fromString('invalid')).toThrow('Invalid TTL string')
    })
  })

  describe('fromMs', () => {
    it('creates from number', () => {
      expect(Ttl.fromMs(60000).toMs()).toBe(60000)
    })

    it('throws on negative number', () => {
      expect(() => Ttl.fromMs(-1000)).toThrow('Invalid TTL value')
    })

    it('throws on zero', () => {
      expect(() => Ttl.fromMs(0)).toThrow('Invalid TTL value')
    })

    it('throws on NaN', () => {
      expect(() => Ttl.fromMs(NaN)).toThrow('Invalid TTL value')
    })
  })

  describe('equals', () => {
    it('returns true for same value', () => {
      expect(Ttl.fromMs(60000).equals(Ttl.fromString('1m'))).toBe(true)
    })

    it('returns false for different value', () => {
      expect(Ttl.fromMs(60000).equals(Ttl.fromMs(120000))).toBe(false)
    })
  })
})
