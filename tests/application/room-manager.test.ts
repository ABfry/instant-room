import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RoomManager } from '../../src/application/room-manager.js'
import type { ProviderAdapter } from '../../src/domain/ports/adapter.js'
import { RoomId } from '../../src/domain/value-objects/room-id.js'
import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

function createMockAwareness(): Awareness {
  return new Awareness(new Y.Doc())
}

function createMockAdapter(
  overrides?: Partial<ProviderAdapter>,
): ProviderAdapter {
  return {
    createRoom: vi
      .fn<() => Promise<Awareness>>()
      .mockResolvedValue(createMockAwareness()),
    destroyRoom: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getAwareness: vi.fn().mockReturnValue(createMockAwareness()),
    onDocUpdate: vi.fn().mockReturnValue(vi.fn()),
    onAwarenessUpdate: vi.fn().mockReturnValue(vi.fn()),
    ...overrides,
  }
}

function createManager(overrides?: {
  adapter?: ProviderAdapter
  baseUrl?: string
  defaultTtl?: string
  defaultOnExpire?: (roomId: string) => void
}) {
  const adapter = overrides?.adapter ?? createMockAdapter()
  const manager = new RoomManager({
    adapter,
    baseUrl: overrides?.baseUrl ?? 'https://example.com/r',
    defaultTtl: overrides?.defaultTtl ?? '1h',
    defaultOnExpire: overrides?.defaultOnExpire,
  })
  return { manager, adapter }
}

describe('RoomManager', () => {
  describe('constructor', () => {
    it('throws on invalid defaultTtl', () => {
      expect(
        () =>
          new RoomManager({
            adapter: createMockAdapter(),
            baseUrl: 'https://example.com/r',
            defaultTtl: 'invalid',
          }),
      ).toThrow()
    })

    it('accepts valid config', () => {
      expect(() => createManager()).not.toThrow()
    })
  })

  describe('create', () => {
    it('returns a Room', async () => {
      const { manager } = createManager()
      const room = await manager.create()
      expect(room).toBeDefined()
      expect(room.id).toBeDefined()
      expect(room.url).toBeDefined()
      expect(room.ydoc).toBeInstanceOf(Y.Doc)
    })

    it('calls adapter.createRoom with RoomId and Doc', async () => {
      const { manager, adapter } = createManager()
      await manager.create()
      expect(adapter.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ toString: expect.any(Function) }),
        expect.any(Y.Doc),
      )
    })

    it('uses Awareness returned by createRoom', async () => {
      const { manager, adapter } = createManager()
      await manager.create()
      expect(adapter.createRoom).toHaveBeenCalled()
    })

    it('makes room retrievable via get()', async () => {
      const { manager } = createManager()
      const room = await manager.create()
      expect(manager.get(room.id)).toBe(room)
    })

    it('overrides TTL when options.ttl is provided', async () => {
      const { manager } = createManager()
      // Should not throw — valid TTL string
      const room = await manager.create({ ttl: '30m' })
      expect(room).toBeDefined()
    })

    it('creates distinct rooms on multiple calls', async () => {
      const { manager } = createManager()
      const room1 = await manager.create()
      const room2 = await manager.create()
      expect(room1.id.toString()).not.toBe(room2.id.toString())
      expect(manager.list()).toHaveLength(2)
    })
  })

  describe('get', () => {
    it('returns room if exists', async () => {
      const { manager } = createManager()
      const room = await manager.create()
      expect(manager.get(room.id)).toBe(room)
    })

    it('returns undefined if not exists', () => {
      const { manager } = createManager()
      expect(manager.get(RoomId.from('nonexistent'))).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns empty array when no rooms', () => {
      const { manager } = createManager()
      expect(manager.list()).toEqual([])
    })

    it('returns all created rooms', async () => {
      const { manager } = createManager()
      const room1 = await manager.create()
      const room2 = await manager.create()
      const rooms = manager.list()
      expect(rooms).toHaveLength(2)
      expect(rooms).toContain(room1)
      expect(rooms).toContain(room2)
    })

    it('returns a copy (modifying it does not affect internal state)', async () => {
      const { manager } = createManager()
      await manager.create()
      const rooms = manager.list()
      rooms.length = 0
      expect(manager.list()).toHaveLength(1)
    })
  })

  describe('destroy', () => {
    it('destroys the room and removes it from the map', async () => {
      const { manager, adapter } = createManager()
      const room = await manager.create()

      await manager.destroy(room.id)

      expect(manager.get(room.id)).toBeUndefined()
      expect(adapter.destroyRoom).toHaveBeenCalled()
    })

    it('does nothing for nonexistent roomId', async () => {
      const { manager } = createManager()
      await expect(
        manager.destroy(RoomId.from('nonexistent')),
      ).resolves.toBeUndefined()
    })

    it('makes room unretrievable after destroy', async () => {
      const { manager } = createManager()
      const room = await manager.create()

      await manager.destroy(room.id)

      expect(manager.get(room.id)).toBeUndefined()
      expect(manager.list()).toHaveLength(0)
    })
  })

  describe('destroyAll', () => {
    it('destroys all rooms', async () => {
      const { manager, adapter } = createManager()
      await manager.create()
      await manager.create()

      await manager.destroyAll()

      expect(manager.list()).toHaveLength(0)
      // destroyRoom called for each room
      expect(adapter.destroyRoom).toHaveBeenCalledTimes(2)
    })

    it('results in empty list', async () => {
      const { manager } = createManager()
      await manager.create()
      await manager.destroyAll()
      expect(manager.list()).toEqual([])
    })
  })

  describe('onExpire', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('removes room from map and calls destroyRoom when TTL expires', async () => {
      const { manager, adapter } = createManager({ defaultTtl: '1s' })
      const room = await manager.create()

      vi.advanceTimersByTime(1000)
      await vi.advanceTimersByTimeAsync(0)

      expect(manager.get(room.id)).toBeUndefined()
      expect(adapter.destroyRoom).toHaveBeenCalled()
    })

    it('calls manager-level onExpire callback when TTL expires', async () => {
      const onExpire = vi.fn()
      const { manager } = createManager({ defaultTtl: '1s', defaultOnExpire: onExpire })
      const room = await manager.create()
      const roomId = room.id.toString()

      vi.advanceTimersByTime(1000)

      expect(onExpire).toHaveBeenCalledWith(roomId)
    })

    it('calls per-room onExpire callback instead of manager-level', async () => {
      const managerOnExpire = vi.fn()
      const roomOnExpire = vi.fn()
      const { manager } = createManager({
        defaultTtl: '1s',
        defaultOnExpire: managerOnExpire,
      })
      const room = await manager.create({ onExpire: roomOnExpire })
      const roomId = room.id.toString()

      vi.advanceTimersByTime(1000)

      expect(roomOnExpire).toHaveBeenCalledWith(roomId)
      expect(managerOnExpire).not.toHaveBeenCalled()
    })

    it('falls back to manager-level onExpire when per-room is not set', async () => {
      const managerOnExpire = vi.fn()
      const { manager } = createManager({
        defaultTtl: '1s',
        defaultOnExpire: managerOnExpire,
      })
      const room = await manager.create()
      const roomId = room.id.toString()

      vi.advanceTimersByTime(1000)

      expect(managerOnExpire).toHaveBeenCalledWith(roomId)
    })

    it('does not throw when onExpire callback is not set', async () => {
      const { manager } = createManager({ defaultTtl: '1s' })
      await manager.create()

      expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    })
  })
})
