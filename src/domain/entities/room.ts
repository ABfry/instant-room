import type { Doc } from 'yjs'
import type { Participant } from '../types/participant.js'
import type { ProviderAdapter } from '../ports/adapter.js'
import type { RoomId } from '../value-objects/room-id.js'
import type { AwarenessWrapper } from './awareness.js'
import type { TtlTimer } from './ttl-timer.js'

/**
 * Integrates TTL, Awareness, and ProviderAdapter into a single room entity.
 */
export class Room {
  private destroyed = false
  private readonly unsubDocUpdate: () => void

  public readonly id: string
  public readonly url: string
  public readonly ydoc: Doc

  constructor(
    private readonly awarenessWrapper: AwarenessWrapper,
    private readonly provider: ProviderAdapter,
    private readonly roomId: RoomId,
    private readonly timer: TtlTimer,
    url: string,
    ydoc: Doc,
  ) {
    this.id = roomId.toString()
    this.url = url
    this.ydoc = ydoc

    // Wire doc updates to timer reset
    this.unsubDocUpdate = provider.onDocUpdate(roomId, () => timer.reset())

    // Start the TTL timer
    timer.start()
  }

  /** Get all connected participants */
  getParticipants(): Participant[] {
    return this.awarenessWrapper.getParticipants()
  }

  /** Subscribe to participant join events. Returns unsubscribe function. */
  onJoin(cb: (participant: Participant) => void): () => void {
    return this.awarenessWrapper.onJoin(cb)
  }

  /** Subscribe to participant leave events. Returns unsubscribe function. */
  onLeave(cb: (clientId: number) => void): () => void {
    return this.awarenessWrapper.onLeave(cb)
  }

  /** Subscribe to participant state update events. Returns unsubscribe function. */
  onUpdate(cb: (participant: Participant) => void): () => void {
    return this.awarenessWrapper.onUpdate(cb)
  }

  /** Subscribe to document update events. Returns unsubscribe function. */
  onDocUpdate(cb: () => void): () => void {
    return this.provider.onDocUpdate(this.roomId, cb)
  }

  /** Destroy the room and release all resources */
  async destroy(): Promise<void> {
    if (this.destroyed) return
    this.destroyed = true

    this.unsubDocUpdate()
    this.timer.destroy()
    this.awarenessWrapper.destroy()
    await this.provider.destroyRoom(this.roomId)
  }
}
