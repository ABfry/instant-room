import type { Doc } from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

/** Port interface for provider adapters */
export interface ProviderAdapter {
  /** Create/register a room on the provider */
  createRoom(roomId: string, ydoc: Doc): Promise<void> | void

  /** Destroy a room on the provider */
  destroyRoom(roomId: string): Promise<void> | void

  /** Get the Awareness instance for a room */
  getAwareness(roomId: string): Awareness | null

  /** Subscribe to document updates */
  onDocUpdate(roomId: string, callback: () => void): () => void

  /** Subscribe to awareness updates */
  onAwarenessUpdate(roomId: string, callback: () => void): () => void
}
