import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { Room } from '../../../src/domain/entities/room.js'
import { RoomId } from '../../../src/domain/value-objects/room-id.js'
import type { ProviderAdapter } from '../../../src/domain/ports/adapter.js'
import type { AwarenessWrapper } from '../../../src/domain/entities/awareness.js'
import type { TtlTimer } from '../../../src/domain/entities/ttl-timer.js'
import type { Participant } from '../../../src/domain/types/participant.js'

function createMockProvider(): ProviderAdapter {
  const unsubDocUpdate = vi.fn()
  return {
    createRoom: vi
      .fn<() => Promise<Awareness>>()
      .mockResolvedValue(new Awareness(new Y.Doc())),
    destroyRoom: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getAwareness: vi.fn().mockReturnValue(null),
    onDocUpdate: vi.fn().mockReturnValue(unsubDocUpdate),
    onAwarenessUpdate: vi.fn().mockReturnValue(vi.fn()),
  }
}

function createMockAwareness(): AwarenessWrapper {
  return {
    getParticipants: vi.fn().mockReturnValue([]),
    setLocalState: vi.fn(),
    clearLocalState: vi.fn(),
    onJoin: vi.fn().mockReturnValue(vi.fn()),
    onLeave: vi.fn().mockReturnValue(vi.fn()),
    onUpdate: vi.fn().mockReturnValue(vi.fn()),
    destroy: vi.fn(),
  } as unknown as AwarenessWrapper
}

function createMockTimer(): TtlTimer {
  return {
    start: vi.fn(),
    reset: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    isRunning: false,
  } as unknown as TtlTimer
}

function createRoom(overrides?: {
  awareness?: AwarenessWrapper
  provider?: ProviderAdapter
  timer?: TtlTimer
  url?: string
  ydoc?: Y.Doc
}) {
  const awareness = overrides?.awareness ?? createMockAwareness()
  const provider = overrides?.provider ?? createMockProvider()
  const timer = overrides?.timer ?? createMockTimer()
  const roomId = RoomId.from('test-room')
  const url = overrides?.url ?? 'https://example.com/r/test-room'
  const ydoc = overrides?.ydoc ?? new Y.Doc()

  const room = new Room(roomId, url, ydoc, {
    awarenessWrapper: awareness,
    provider,
    timer,
  })
  return { room, awareness, provider, timer, roomId, url, ydoc }
}

describe('Room', () => {
  describe('constructor', () => {
    it('exposes id as RoomId', () => {
      const { room, roomId } = createRoom()
      expect(room.id).toBe(roomId)
    })

    it('exposes url as provided', () => {
      const { room } = createRoom({ url: 'https://myapp.com/r/test-room' })
      expect(room.url).toBe('https://myapp.com/r/test-room')
    })

    it('exposes ydoc as provided', () => {
      const ydoc = new Y.Doc()
      const { room } = createRoom({ ydoc })
      expect(room.ydoc).toBe(ydoc)
    })

    it('does not start the timer on construction', () => {
      const { timer } = createRoom()
      expect(timer.start).not.toHaveBeenCalled()
    })

    it('subscribes to provider.onDocUpdate on construction', () => {
      const { provider, roomId } = createRoom()
      expect(provider.onDocUpdate).toHaveBeenCalledWith(
        roomId,
        expect.any(Function),
      )
    })

    it('subscribes to provider.onAwarenessUpdate on construction', () => {
      const { provider, roomId } = createRoom()
      expect(provider.onAwarenessUpdate).toHaveBeenCalledWith(
        roomId,
        expect.any(Function),
      )
    })
  })

  describe('start', () => {
    it('starts the timer', () => {
      const { room, timer } = createRoom()
      room.start()
      expect(timer.start).toHaveBeenCalledOnce()
    })
  })

  describe('TTL reset on doc update', () => {
    it('resets timer when doc update callback fires after start', () => {
      const provider = createMockProvider()
      const timer = createMockTimer()
      const { room } = createRoom({ provider, timer })
      room.start()

      const docUpdateCallback = (
        provider.onDocUpdate as ReturnType<typeof vi.fn>
      ).mock.calls[0][1] as () => void
      docUpdateCallback()

      expect(timer.reset).toHaveBeenCalledOnce()
    })

    it('does not reset timer when doc update fires before start', () => {
      const provider = createMockProvider()
      const timer = createMockTimer()
      createRoom({ provider, timer })

      const docUpdateCallback = (
        provider.onDocUpdate as ReturnType<typeof vi.fn>
      ).mock.calls[0][1] as () => void
      docUpdateCallback()

      expect(timer.reset).not.toHaveBeenCalled()
    })
  })

  describe('TTL reset on awareness update', () => {
    it('resets timer when awareness update callback fires after start', () => {
      const provider = createMockProvider()
      const timer = createMockTimer()
      const { room } = createRoom({ provider, timer })
      room.start()

      const awarenessUpdateCallback = (
        provider.onAwarenessUpdate as ReturnType<typeof vi.fn>
      ).mock.calls[0][1] as () => void
      awarenessUpdateCallback()

      expect(timer.reset).toHaveBeenCalledOnce()
    })

    it('does not reset timer when awareness update fires before start', () => {
      const provider = createMockProvider()
      const timer = createMockTimer()
      createRoom({ provider, timer })

      const awarenessUpdateCallback = (
        provider.onAwarenessUpdate as ReturnType<typeof vi.fn>
      ).mock.calls[0][1] as () => void
      awarenessUpdateCallback()

      expect(timer.reset).not.toHaveBeenCalled()
    })
  })

  describe('getParticipants', () => {
    it('delegates to awarenessWrapper.getParticipants()', () => {
      const awareness = createMockAwareness()
      const participants: Participant[] = [
        { clientId: 1, data: { name: 'Alice' } },
      ]
      ;(awareness.getParticipants as ReturnType<typeof vi.fn>).mockReturnValue(
        participants,
      )
      const { room } = createRoom({ awareness })

      expect(room.getParticipants()).toBe(participants)
    })
  })

  describe('onJoin', () => {
    it('delegates to awarenessWrapper.onJoin()', () => {
      const awareness = createMockAwareness()
      const unsub = vi.fn()
      ;(awareness.onJoin as ReturnType<typeof vi.fn>).mockReturnValue(unsub)
      const { room } = createRoom({ awareness })

      const cb = vi.fn()
      const result = room.onJoin(cb)

      expect(awareness.onJoin).toHaveBeenCalledWith(cb)
      expect(result).toBe(unsub)
    })
  })

  describe('onLeave', () => {
    it('delegates to awarenessWrapper.onLeave()', () => {
      const awareness = createMockAwareness()
      const unsub = vi.fn()
      ;(awareness.onLeave as ReturnType<typeof vi.fn>).mockReturnValue(unsub)
      const { room } = createRoom({ awareness })

      const cb = vi.fn()
      const result = room.onLeave(cb)

      expect(awareness.onLeave).toHaveBeenCalledWith(cb)
      expect(result).toBe(unsub)
    })
  })

  describe('onUpdate', () => {
    it('delegates to awarenessWrapper.onUpdate()', () => {
      const awareness = createMockAwareness()
      const unsub = vi.fn()
      ;(awareness.onUpdate as ReturnType<typeof vi.fn>).mockReturnValue(unsub)
      const { room } = createRoom({ awareness })

      const cb = vi.fn()
      const result = room.onUpdate(cb)

      expect(awareness.onUpdate).toHaveBeenCalledWith(cb)
      expect(result).toBe(unsub)
    })
  })

  describe('onDocUpdate', () => {
    it('delegates to provider.onDocUpdate()', () => {
      const provider = createMockProvider()
      const unsub = vi.fn()
      // First call is from constructor, second from explicit call
      ;(provider.onDocUpdate as ReturnType<typeof vi.fn>).mockReturnValue(unsub)
      const { room, roomId } = createRoom({ provider })

      const cb = vi.fn()
      room.onDocUpdate(cb)

      expect(provider.onDocUpdate).toHaveBeenCalledWith(roomId, cb)
    })

    it('throws if room is already destroyed', async () => {
      const { room } = createRoom()
      await room.destroy()
      expect(() => room.onDocUpdate(vi.fn())).toThrow('Room already destroyed')
    })

    it('calls provider unsubscribe when returned function is called', () => {
      const provider = createMockProvider()
      const providerUnsub = vi.fn()
      ;(provider.onDocUpdate as ReturnType<typeof vi.fn>).mockReturnValue(
        providerUnsub,
      )
      const { room } = createRoom({ provider })

      const unsub = room.onDocUpdate(vi.fn())
      unsub()

      expect(providerUnsub).toHaveBeenCalledOnce()
    })
  })

  describe('destroy', () => {
    it('calls unsubscribe for internal doc update listener', async () => {
      const unsub = vi.fn()
      const provider = createMockProvider()
      ;(provider.onDocUpdate as ReturnType<typeof vi.fn>).mockReturnValue(unsub)
      const { room } = createRoom({ provider })

      await room.destroy()

      expect(unsub).toHaveBeenCalledOnce()
    })

    it('calls unsubscribe for internal awareness update listener', async () => {
      const unsub = vi.fn()
      const provider = createMockProvider()
      ;(provider.onAwarenessUpdate as ReturnType<typeof vi.fn>).mockReturnValue(
        unsub,
      )
      const { room } = createRoom({ provider })

      await room.destroy()

      expect(unsub).toHaveBeenCalledOnce()
    })

    it('destroys the timer', async () => {
      const { room, timer } = createRoom()
      await room.destroy()
      expect(timer.destroy).toHaveBeenCalledOnce()
    })

    it('destroys the awareness wrapper', async () => {
      const { room, awareness } = createRoom()
      await room.destroy()
      expect(awareness.destroy).toHaveBeenCalledOnce()
    })

    it('destroys the room on the provider', async () => {
      const { room, provider, roomId } = createRoom()
      await room.destroy()
      expect(provider.destroyRoom).toHaveBeenCalledWith(roomId)
    })

    it('unsubscribes external onDocUpdate listeners', async () => {
      const provider = createMockProvider()
      const providerUnsubInternal = vi.fn()
      const providerUnsubExternal1 = vi.fn()
      const providerUnsubExternal2 = vi.fn()
      ;(provider.onDocUpdate as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(providerUnsubInternal) // internal (constructor)
        .mockReturnValueOnce(providerUnsubExternal1) // first external
        .mockReturnValueOnce(providerUnsubExternal2) // second external
      const { room } = createRoom({ provider })

      room.onDocUpdate(vi.fn())
      room.onDocUpdate(vi.fn())
      await room.destroy()

      expect(providerUnsubInternal).toHaveBeenCalledTimes(1)
      expect(providerUnsubExternal1).toHaveBeenCalledTimes(1)
      expect(providerUnsubExternal2).toHaveBeenCalledTimes(1)
    })

    it('does not double-unsubscribe manually removed listeners', async () => {
      const provider = createMockProvider()
      const providerUnsubInternal = vi.fn()
      const providerUnsubExternal = vi.fn()
      ;(provider.onDocUpdate as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(providerUnsubInternal) // internal (constructor)
        .mockReturnValueOnce(providerUnsubExternal) // external
      const { room } = createRoom({ provider })

      const unsub = room.onDocUpdate(vi.fn())
      unsub() // manual unsubscribe
      await room.destroy()

      expect(providerUnsubInternal).toHaveBeenCalledTimes(1)
      expect(providerUnsubExternal).toHaveBeenCalledTimes(1)
    })

    it('is idempotent', async () => {
      const { room, timer, awareness, provider } = createRoom()
      await room.destroy()
      await room.destroy()

      expect(timer.destroy).toHaveBeenCalledOnce()
      expect(awareness.destroy).toHaveBeenCalledOnce()
      expect(provider.destroyRoom).toHaveBeenCalledOnce()
    })

    it('returns a promise', () => {
      const { room } = createRoom()
      const result = room.destroy()
      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('touch', () => {
    it('resets the timer', () => {
      const { room, timer } = createRoom()
      room.touch()
      expect(timer.reset).toHaveBeenCalledOnce()
    })
  })
})
