import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from 'y-protocols/awareness'
import { AwarenessWrapper } from '../../../src/domain/entities/awareness.js'

function createAwareness(): Awareness {
  return new Awareness(new Y.Doc())
}

/** Simulate a remote client joining awareness1 */
function simulateRemoteJoin(
  awareness1: Awareness,
  state: Record<string, unknown>,
): { clientId: number; awareness: Awareness } {
  const doc2 = new Y.Doc()
  const awareness2 = new Awareness(doc2)
  awareness2.setLocalState(state)
  const update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
  applyAwarenessUpdate(awareness1, update, 'remote')
  return { clientId: awareness2.clientID, awareness: awareness2 }
}

describe('AwarenessWrapper', () => {
  it('throws if awareness is null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => new AwarenessWrapper(null as any)).toThrow(
      'Awareness instance is required',
    )
  })

  describe('getParticipants', () => {
    it('returns empty array when no states are set', () => {
      const wrapper = new AwarenessWrapper(createAwareness())
      expect(wrapper.getParticipants()).toEqual([])
    })

    it('returns participants with state', () => {
      const awareness = createAwareness()
      awareness.setLocalState({ name: 'Alice' })

      const wrapper = new AwarenessWrapper(awareness)
      const participants = wrapper.getParticipants()

      expect(participants).toHaveLength(1)
      expect(participants[0].clientId).toBe(awareness.clientID)
      expect(participants[0].data).toEqual({ name: 'Alice' })
    })

    it('excludes clients with empty state', () => {
      const awareness = createAwareness()
      awareness.setLocalState({})

      const wrapper = new AwarenessWrapper(awareness)
      expect(wrapper.getParticipants()).toEqual([])
    })
  })

  describe('setLocalState', () => {
    it('sets local client state', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)

      wrapper.setLocalState({ name: 'Bob', color: '#ff0000' })

      const state = awareness.getLocalState()
      expect(state).toEqual({ name: 'Bob', color: '#ff0000' })
    })
  })

  describe('clearLocalState', () => {
    it('clears local client state', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)

      wrapper.setLocalState({ name: 'Carol' })
      wrapper.clearLocalState()

      const state = awareness.getLocalState()
      expect(state).toBeNull()
    })

    it('triggers onLeave for local client', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      wrapper.setLocalState({ name: 'Carol' })
      wrapper.onLeave(cb)
      wrapper.clearLocalState()

      expect(cb).toHaveBeenCalledOnce()
      expect(cb).toHaveBeenCalledWith(awareness.clientID)
    })
  })

  describe('onJoin', () => {
    it('fires callback when a remote client joins with state', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      wrapper.onJoin(cb)
      const { clientId } = simulateRemoteJoin(awareness, { name: 'Charlie' })

      expect(cb).toHaveBeenCalledOnce()
      expect(cb).toHaveBeenCalledWith({
        clientId,
        data: { name: 'Charlie' },
      })
    })

    it('does not fire for empty state', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      wrapper.onJoin(cb)
      simulateRemoteJoin(awareness, {})

      expect(cb).not.toHaveBeenCalled()
    })

    it('fires when state transitions from empty to non-empty', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      wrapper.onJoin(cb)

      // Join with empty state
      const doc2 = new Y.Doc()
      const awareness2 = new Awareness(doc2)
      awareness2.setLocalState({})
      let update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
      applyAwarenessUpdate(awareness, update, 'remote')
      expect(cb).not.toHaveBeenCalled()

      // Update to non-empty state
      awareness2.setLocalState({ name: 'Dave' })
      update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
      applyAwarenessUpdate(awareness, update, 'remote')

      expect(cb).toHaveBeenCalledOnce()
      expect(cb).toHaveBeenCalledWith({
        clientId: awareness2.clientID,
        data: { name: 'Dave' },
      })
    })

    it('returns unsubscribe function', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      const unsub = wrapper.onJoin(cb)
      unsub()

      simulateRemoteJoin(awareness, { name: 'Eve' })
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('onLeave', () => {
    it('fires callback when a client leaves', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      awareness.setLocalState({ name: 'Frank' })
      wrapper.onLeave(cb)

      awareness.setLocalState(null)

      expect(cb).toHaveBeenCalledOnce()
      expect(cb).toHaveBeenCalledWith(awareness.clientID)
    })

    it('fires when a connected client clears state', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      // Join with state, then clear it (still connected)
      const doc2 = new Y.Doc()
      const awareness2 = new Awareness(doc2)
      awareness2.setLocalState({ name: 'Grace' })
      let update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
      applyAwarenessUpdate(awareness, update, 'remote')

      wrapper.onLeave(cb)

      // Clear state — triggers updated, not removed
      awareness2.setLocalState({})
      update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
      applyAwarenessUpdate(awareness, update, 'remote')

      expect(cb).toHaveBeenCalledOnce()
      expect(cb).toHaveBeenCalledWith(awareness2.clientID)
    })

    it('returns unsubscribe function', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      awareness.setLocalState({ name: 'Hank' })
      const unsub = wrapper.onLeave(cb)
      unsub()

      awareness.setLocalState(null)
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('onUpdate', () => {
    it('fires callback when a known participant updates state', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      // Join first
      const doc2 = new Y.Doc()
      const awareness2 = new Awareness(doc2)
      awareness2.setLocalState({ name: 'Hank' })
      let update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
      applyAwarenessUpdate(awareness, update, 'remote')

      wrapper.onUpdate(cb)

      // Update state
      awareness2.setLocalState({ name: 'Hank', cursor: { x: 10, y: 20 } })
      update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
      applyAwarenessUpdate(awareness, update, 'remote')

      expect(cb).toHaveBeenCalledOnce()
      expect(cb).toHaveBeenCalledWith({
        clientId: awareness2.clientID,
        data: { name: 'Hank', cursor: { x: 10, y: 20 } },
      })
    })

    it('does not fire for unknown clients', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      wrapper.onUpdate(cb)

      // Join with empty state — not a known participant
      const doc2 = new Y.Doc()
      const awareness2 = new Awareness(doc2)
      awareness2.setLocalState({})
      let update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
      applyAwarenessUpdate(awareness, update, 'remote')

      // Update still empty
      awareness2.setLocalState({})
      update = encodeAwarenessUpdate(awareness2, [awareness2.clientID])
      applyAwarenessUpdate(awareness, update, 'remote')

      expect(cb).not.toHaveBeenCalled()
    })

    it('returns unsubscribe function', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const cb = vi.fn()

      awareness.setLocalState({ name: 'Ivy' })
      const unsub = wrapper.onUpdate(cb)
      unsub()

      awareness.setLocalState({ name: 'Ivy', cursor: { x: 0, y: 0 } })
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('removes all listeners', () => {
      const awareness = createAwareness()
      const wrapper = new AwarenessWrapper(awareness)
      const joinCb = vi.fn()
      const leaveCb = vi.fn()
      const updateCb = vi.fn()

      wrapper.onJoin(joinCb)
      wrapper.onLeave(leaveCb)
      wrapper.onUpdate(updateCb)
      wrapper.destroy()

      simulateRemoteJoin(awareness, { name: 'Jack' })

      expect(joinCb).not.toHaveBeenCalled()
      expect(leaveCb).not.toHaveBeenCalled()
      expect(updateCb).not.toHaveBeenCalled()
    })

    it('is idempotent', () => {
      const wrapper = new AwarenessWrapper(createAwareness())
      expect(() => {
        wrapper.destroy()
        wrapper.destroy()
      }).not.toThrow()
    })
  })
})
