import { Doc } from 'yjs'
import type { ProviderAdapter } from '../domain/ports/adapter.js'
import { Room } from '../domain/entities/room.js'
import { AwarenessWrapper } from '../domain/entities/awareness.js'
import { TtlTimer } from '../domain/entities/ttl-timer.js'
import { RoomId } from '../domain/value-objects/room-id.js'
import { Ttl } from '../domain/value-objects/ttl.js'

export interface RoomManagerConfig {
  adapter: ProviderAdapter
  baseUrl: string
  defaultTtl: string
  defaultOnExpire?: (roomId: string) => void
}

/**
 * Assembles and manages Room lifecycle.
 */
export class RoomManager {
  private readonly adapter: ProviderAdapter
  private readonly baseUrl: string
  private readonly defaultTtl: Ttl
  private readonly onExpireCallback?: (roomId: string) => void
  private readonly rooms = new Map<string, Room>()

  constructor(config: RoomManagerConfig) {
    this.adapter = config.adapter
    this.baseUrl = config.baseUrl
    this.defaultTtl = Ttl.fromString(config.defaultTtl)
    this.onExpireCallback = config.defaultOnExpire
  }

  /** Create a new room with optional TTL and onExpire override */
  async create(options?: {
    ttl?: string
    onExpire?: (roomId: string) => void
  }): Promise<Room> {
    const roomId = RoomId.generate()
    const url = roomId.buildUrl(this.baseUrl)
    const ydoc = new Doc()

    await this.adapter.createRoom(roomId, ydoc)

    try {
      const awareness = this.adapter.getAwareness(roomId)
      if (!awareness) {
        throw new Error('Awareness not available after createRoom')
      }

      const awarenessWrapper = new AwarenessWrapper(awareness)

      const ttl = options?.ttl ? Ttl.fromString(options.ttl) : this.defaultTtl

      const expireCallback = options?.onExpire ?? this.onExpireCallback

      const onExpire = () => {
        this.destroy(roomId).catch((err: unknown) => {
          console.error(`Failed to destroy room ${roomId}:`, err)
        })
        try {
          expireCallback?.(roomId.toString())
        } catch (err) {
          console.error('Error in onExpire callback:', err)
        }
      }

      const timer = new TtlTimer(ttl.toMs(), onExpire)

      const room = new Room(
        roomId,
        url,
        ydoc,
        awarenessWrapper,
        this.adapter,
        timer,
      )

      this.rooms.set(roomId.toString(), room)
      return room
    } catch (err) {
      await this.adapter.destroyRoom(roomId)
      throw err
    }
  }

  /** Get a room by its ID */
  get(roomId: RoomId): Room | undefined {
    return this.rooms.get(roomId.toString())
  }

  /** List all active rooms */
  list(): Room[] {
    return [...this.rooms.values()]
  }

  /** Destroy a specific room */
  async destroy(roomId: RoomId): Promise<void> {
    const room = this.rooms.get(roomId.toString())
    if (!room) return
    this.rooms.delete(roomId.toString())
    await room.destroy()
  }

  /** Destroy all rooms */
  async destroyAll(): Promise<void> {
    const rooms = [...this.rooms.values()]
    this.rooms.clear()
    const results = await Promise.allSettled(rooms.map((r) => r.destroy()))
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('Failed to destroy room:', result.reason)
      }
    }
  }
}
