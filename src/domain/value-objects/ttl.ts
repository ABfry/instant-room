import ms from 'ms'

/** Value Object representing a TTL (Time To Live) duration in milliseconds */
export class Ttl {
  private constructor(private readonly value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid TTL value: ${value}`)
    }
  }

  /** Create a Ttl from a human-readable string ('2h', '30m', '1d') */
  static fromString(ttl: string): Ttl {
    const parsed = ms(ttl as ms.StringValue)
    if (parsed === undefined) {
      throw new Error(`Invalid TTL string: ${ttl}`)
    }
    return new Ttl(parsed)
  }

  /** Create a Ttl from a number (milliseconds) */
  static fromMs(value: number): Ttl {
    return new Ttl(value)
  }

  /** Get the TTL value in milliseconds */
  toMs(): number {
    return this.value
  }

  /** Value equality check */
  equals(other: Ttl): boolean {
    return this.value === other.value
  }
}
