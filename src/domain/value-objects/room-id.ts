import { nanoid } from 'nanoid'

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]+$/

/** Value Object representing a unique room identifier */
export class RoomId {
  private constructor(private readonly value: string) {
    if (!value || value.length === 0) {
      throw new Error('RoomId cannot be empty')
    }
    if (!ROOM_ID_PATTERN.test(value)) {
      throw new Error(`RoomId contains invalid characters: ${value}`)
    }
  }

  /** Generate a new RoomId using nanoid */
  static generate(length = 12): RoomId {
    return new RoomId(nanoid(length))
  }

  /** Restore a RoomId from an existing string value */
  static from(value: string): RoomId {
    return new RoomId(value)
  }

  /** Build a full room URL */
  buildUrl(baseUrl: string): string {
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    return `${base}/${this.value}`
  }

  /** Get the raw string value */
  toString(): string {
    return this.value
  }

  /** Value equality check */
  equals(other: RoomId): boolean {
    return this.value === other.value
  }
}
