import { describe, it, expect } from 'vitest'
import { RoomId } from '../../../src/domain/value-objects/room-id.js'

describe('RoomId', () => {
  describe('generate', () => {
    it('generates an ID with default length of 12', () => {
      const id = RoomId.generate()
      expect(id.toString()).toHaveLength(12)
    })

    it('generates an ID with custom length', () => {
      const id = RoomId.generate(8)
      expect(id.toString()).toHaveLength(8)
    })

    it('generates IDs with valid characters', () => {
      const id = RoomId.generate()
      expect(id.toString()).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('throws on zero length', () => {
      expect(() => RoomId.generate(0)).toThrow('Invalid RoomId length')
    })

    it('throws on negative length', () => {
      expect(() => RoomId.generate(-1)).toThrow('Invalid RoomId length')
    })

    it('throws on non-integer length', () => {
      expect(() => RoomId.generate(3.5)).toThrow('Invalid RoomId length')
    })
  })

  describe('from', () => {
    it('restores a RoomId from a string', () => {
      const id = RoomId.from('abc123')
      expect(id.toString()).toBe('abc123')
    })

    it('throws on empty string', () => {
      expect(() => RoomId.from('')).toThrow('RoomId cannot be empty')
    })

    it('throws on invalid characters', () => {
      expect(() => RoomId.from('room id!')).toThrow('invalid characters')
      expect(() => RoomId.from('room/id')).toThrow('invalid characters')
    })

    it('accepts valid nanoid characters (A-Za-z0-9_-)', () => {
      expect(() => RoomId.from('V1StGXR8_Z5j')).not.toThrow()
      expect(() => RoomId.from('abc-123_XYZ')).not.toThrow()
    })
  })

  describe('buildUrl', () => {
    it('joins baseUrl and roomId', () => {
      const id = RoomId.from('abc123')
      expect(id.buildUrl('https://myapp.com/r')).toBe(
        'https://myapp.com/r/abc123',
      )
    })

    it('handles trailing slash on baseUrl', () => {
      const id = RoomId.from('abc123')
      expect(id.buildUrl('https://myapp.com/r/')).toBe(
        'https://myapp.com/r/abc123',
      )
    })
  })

  describe('equals', () => {
    it('returns true for same value', () => {
      const a = RoomId.from('abc123')
      const b = RoomId.from('abc123')
      expect(a.equals(b)).toBe(true)
    })

    it('returns false for different value', () => {
      const a = RoomId.from('abc123')
      const b = RoomId.from('xyz789')
      expect(a.equals(b)).toBe(false)
    })
  })
})
