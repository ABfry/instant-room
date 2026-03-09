import type { Doc } from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import type { RoomId } from '../value-objects/room-id.js'

/** Port interface for provider adapters */
export interface ProviderAdapter {
  /** Create/register a room on the provider */
  createRoom(roomId: RoomId, ydoc: Doc): Promise<void>

  /** Destroy a room on the provider */
  destroyRoom(roomId: RoomId): Promise<void>

  /** Get the Awareness instance for a room */
  getAwareness(roomId: RoomId): Awareness | null

  /** Subscribe to document updates */
  onDocUpdate(roomId: RoomId, callback: () => void): () => void

  /** Subscribe to awareness updates */
  onAwarenessUpdate(roomId: RoomId, callback: () => void): () => void
}
