import type { Doc } from 'yjs'
import type { Participant } from '../types/participant.js'
import type { ProviderAdapter } from '../ports/adapter.js'
import type { RoomId } from '../value-objects/room-id.js'
import type { AwarenessWrapper } from './awareness.js'
import type { TtlTimer } from './ttl-timer.js'

export interface RoomDeps {
  awarenessWrapper: AwarenessWrapper
  provider: ProviderAdapter
  timer: TtlTimer
}

/**
 * Integrates TTL, Awareness, and ProviderAdapter into a single room entity.
 */
export class Room {
  private destroyed = false
  private readonly unsubDocUpdate: () => void
  private readonly unsubAwarenessUpdate: () => void
  private readonly externalDocUpdateUnsubs = new Set<() => void>()
  private readonly awarenessWrapper: AwarenessWrapper
  private readonly provider: ProviderAdapter
  private readonly timer: TtlTimer

  public readonly id: RoomId
  public readonly url: string
  public readonly ydoc: Doc

  constructor(id: RoomId, url: string, ydoc: Doc, deps: RoomDeps) {
    this.id = id
    this.url = url
    this.ydoc = ydoc
    this.awarenessWrapper = deps.awarenessWrapper
    this.provider = deps.provider
    this.timer = deps.timer

    // Wire doc and awareness updates to timer reset
    this.unsubDocUpdate = this.provider.onDocUpdate(id, () =>
      this.timer.reset(),
    )
    this.unsubAwarenessUpdate = this.provider.onAwarenessUpdate(id, () =>
      this.timer.reset(),
    )

    // Start the TTL timer
    this.timer.start()
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
    if (this.destroyed) throw new Error('Room already destroyed')
    const unsub = this.provider.onDocUpdate(this.id, cb)
    let called = false
    const wrappedUnsub = () => {
      if (called) return
      called = true
      this.externalDocUpdateUnsubs.delete(wrappedUnsub)
      unsub()
    }
    this.externalDocUpdateUnsubs.add(wrappedUnsub)
    return wrappedUnsub
  }

  /** Touch the room to reset the TTL */
  touch(): void {
    this.timer.reset()
  }

  /** Destroy the room and release all resources */
  async destroy(): Promise<void> {
    if (this.destroyed) return
    this.destroyed = true

    this.unsubDocUpdate()
    this.unsubAwarenessUpdate()
    const externalUnsubs = [...this.externalDocUpdateUnsubs]
    this.externalDocUpdateUnsubs.clear()
    for (const unsub of externalUnsubs) {
      unsub()
    }
    this.timer.destroy()
    this.awarenessWrapper.destroy()
    await this.provider.destroyRoom(this.id)
  }
}
