import { Awareness } from 'y-protocols/awareness'
import type { Participant } from '../types/participant.js'

interface ChangeEvent {
  added: number[] // List of IDs of newly connected users
  updated: number[] // List of IDs of users who updated their state
  removed: number[] // List of IDs of users who disconnected
}

/** Check if a state qualifies as a valid participant */
function hasState(
  state: Record<string, unknown> | undefined | null,
): state is Record<string, unknown> {
  return state != null && Object.keys(state).length > 0
}

/** Provides participant tracking (join/leave/update) on top of Yjs Awareness */
export class AwarenessWrapper {
  private destroyed = false
  private readonly knownClients = new Set<number>()
  private readonly joinCallbacks = new Set<(participant: Participant) => void>()
  private readonly leaveCallbacks = new Set<(clientId: number) => void>()
  private readonly updateCallbacks = new Set<
    (participant: Participant) => void
  >()
  private readonly changeHandler: (changes: ChangeEvent) => void

  constructor(private readonly awareness: Awareness) {
    if (!awareness) {
      throw new Error('Awareness instance is required')
    }

    // Register existing participants
    for (const [clientId, state] of awareness.getStates()) {
      if (hasState(state)) {
        this.knownClients.add(clientId)
      }
    }

    // Single internal change handler
    this.changeHandler = ({ added, updated, removed }: ChangeEvent) => {
      const states = this.awareness.getStates()

      for (const clientId of [...added, ...updated]) {
        const state = states.get(clientId)
        const isValid = hasState(state)
        const isKnown = this.knownClients.has(clientId)

        // New participant: has valid state but not yet tracked → join
        if (isValid && !isKnown) {
          this.knownClients.add(clientId)
          this.emit(this.joinCallbacks, { clientId, data: state })
        // Existing participant: state changed → update
        } else if (isValid && isKnown) {
          this.emit(this.updateCallbacks, { clientId, data: state })
        // Departed participant: state cleared or emptied → leave
        } else if (!isValid && isKnown) {
          this.knownClients.delete(clientId)
          this.emit(this.leaveCallbacks, clientId)
        }
        // (!isValid && !isKnown): unknown client with no state → ignore
      }

      for (const clientId of removed) {
        if (this.knownClients.has(clientId)) {
          this.knownClients.delete(clientId)
          this.emit(this.leaveCallbacks, clientId)
        }
      }
    }

    // Subscribe to change events
    this.awareness.on('change', this.changeHandler)
  }

  /** Get all connected participants */
  getParticipants(): Participant[] {
    const states = this.awareness.getStates()
    const participants: Participant[] = []
    for (const [clientId, state] of states) {
      if (hasState(state)) {
        participants.push({ clientId, data: state })
      }
    }
    return participants
  }

  /** Set local client state */
  setLocalState(data: Record<string, unknown>): void {
    this.awareness.setLocalState(data)
  }

  /** Clear local client state (signals departure to other clients) */
  clearLocalState(): void {
    this.awareness.setLocalState(null)
  }

  /** Subscribe to participant join events. Returns unsubscribe function. */
  onJoin(cb: (participant: Participant) => void): () => void {
    this.joinCallbacks.add(cb)
    return () => {
      this.joinCallbacks.delete(cb)
    }
  }

  /** Subscribe to participant leave events. Returns unsubscribe function. */
  onLeave(cb: (clientId: number) => void): () => void {
    this.leaveCallbacks.add(cb)
    return () => {
      this.leaveCallbacks.delete(cb)
    }
  }

  /** Subscribe to participant state update events. Returns unsubscribe function. */
  onUpdate(cb: (participant: Participant) => void): () => void {
    this.updateCallbacks.add(cb)
    return () => {
      this.updateCallbacks.delete(cb)
    }
  }

  private emit<T>(callbacks: Set<(arg: T) => void>, arg: T): void {
    for (const cb of callbacks) {
      try {
        cb(arg)
      } catch (error) {
        console.error('Error in AwarenessWrapper callback:', error)
      }
    }
  }

  /** Remove all event listeners */
  destroy(): void {
    if (this.destroyed) return
    this.awareness.off('change', this.changeHandler)
    this.joinCallbacks.clear()
    this.leaveCallbacks.clear()
    this.updateCallbacks.clear()
    this.destroyed = true
  }
}
