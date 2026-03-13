import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebSocketServer, WebSocket } from 'ws'
import { Doc } from 'yjs'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { RoomId } from '../../../src/domain/value-objects/room-id.js'
import { YWebsocketAdapter } from '../../../src/infrastructure/adapters/y-websocket.js'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

class BufferedClient {
  readonly ws: WebSocket
  private readonly messages: Uint8Array[] = []
  private waitResolve: ((msg: Uint8Array) => void) | null = null

  constructor(url: string) {
    this.ws = new WebSocket(url)
    this.ws.on('message', (data: ArrayLike<number>) => {
      const msg = new Uint8Array(data)
      if (this.waitResolve) {
        const resolve = this.waitResolve
        this.waitResolve = null
        resolve(msg)
      } else {
        this.messages.push(msg)
      }
    })
  }

  waitForOpen(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        resolve()
      } else {
        this.ws.on('open', () => resolve())
      }
    })
  }

  waitForClose(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) {
        resolve()
      } else {
        this.ws.on('close', () => resolve())
      }
    })
  }

  nextMessage(): Promise<Uint8Array> {
    const buffered = this.messages.shift()
    if (buffered) return Promise.resolve(buffered)
    return new Promise((resolve) => {
      this.waitResolve = resolve
    })
  }

  async drainMessages(waitMs = 20): Promise<Uint8Array[]> {
    await wait(waitMs)
    const drained = [...this.messages]
    this.messages.length = 0
    return drained
  }

  send(data: Uint8Array): void {
    this.ws.send(data)
  }

  close(): void {
    this.ws.close()
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('YWebsocketAdapter', () => {
  let wss: WebSocketServer
  let adapter: YWebsocketAdapter
  let port: number
  const clients: BufferedClient[] = []
  const createdRoomIds: RoomId[] = []

  beforeEach(async () => {
    wss = new WebSocketServer({ port: 0 })
    port = (wss.address() as { port: number }).port
    adapter = new YWebsocketAdapter({ wss })
  })

  afterEach(async () => {
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.CLOSED) {
        client.close()
      }
    }
    clients.length = 0

    for (const roomId of createdRoomIds) {
      await adapter.destroyRoom(roomId)
    }
    createdRoomIds.length = 0

    adapter.destroy()
    await new Promise<void>((resolve) => wss.close(() => resolve()))
  })

  function createClient(roomName: string): BufferedClient {
    const client = new BufferedClient(`ws://localhost:${port}/${roomName}`)
    clients.push(client)
    return client
  }

  async function createRoom(
    name: string,
  ): Promise<{ roomId: RoomId; doc: Doc }> {
    const roomId = RoomId.from(name)
    const doc = new Doc()
    await adapter.createRoom(roomId, doc)
    createdRoomIds.push(roomId)
    return { roomId, doc }
  }

  async function connectAndSync(roomName: string): Promise<BufferedClient> {
    const client = createClient(roomName)
    await client.waitForOpen()
    await client.nextMessage()
    await client.nextMessage()
    await client.drainMessages()
    return client
  }

  // ==========================================================================
  // createRoom / destroyRoom
  // ==========================================================================

  describe('createRoom', () => {
    it('creates a room', async () => {
      const { roomId } = await createRoom('test-room')
      expect(adapter.getAwareness(roomId)).toBeInstanceOf(Awareness)
    })

    it('does not overwrite on duplicate create', async () => {
      const { roomId, doc } = await createRoom('test-room')
      const awareness1 = adapter.getAwareness(roomId)

      await adapter.createRoom(roomId, doc)
      const awareness2 = adapter.getAwareness(roomId)

      expect(awareness1).toBe(awareness2)
    })
  })

  describe('destroyRoom', () => {
    it('destroys a room', async () => {
      const { roomId } = await createRoom('test-room')
      await adapter.destroyRoom(roomId)

      expect(adapter.getAwareness(roomId)).toBeNull()
    })

    it('does nothing for nonexistent room', async () => {
      const roomId = RoomId.from('nonexistent')
      await expect(adapter.destroyRoom(roomId)).resolves.toBeUndefined()
    })

    it('disconnects connected clients', async () => {
      await createRoom('test-room')

      const client = createClient('test-room')
      await client.waitForOpen()

      const closePromise = client.waitForClose()
      await adapter.destroyRoom(RoomId.from('test-room'))
      await closePromise
    })
  })

  describe('getAwareness', () => {
    it('returns null before room creation', () => {
      const roomId = RoomId.from('test-room')
      expect(adapter.getAwareness(roomId)).toBeNull()
    })

    it('returns Awareness instance after room creation', async () => {
      const { roomId } = await createRoom('test-room')
      expect(adapter.getAwareness(roomId)).toBeInstanceOf(Awareness)
    })
  })

  describe('onDocUpdate', () => {
    it('fires callback on document update', async () => {
      const { roomId, doc } = await createRoom('test-room')

      let called = false
      adapter.onDocUpdate(roomId, () => {
        called = true
      })

      doc.getArray('test').push([1])
      expect(called).toBe(true)
    })

    it('does not fire after unsubscribe', async () => {
      const { roomId, doc } = await createRoom('test-room')

      let callCount = 0
      const unsub = adapter.onDocUpdate(roomId, () => {
        callCount++
      })

      doc.getArray('test').push([1])
      expect(callCount).toBe(1)

      unsub()
      doc.getArray('test').push([2])
      expect(callCount).toBe(1)
    })

    it('returns harmless unsubscribe for nonexistent room', () => {
      const roomId = RoomId.from('nonexistent')
      const unsub = adapter.onDocUpdate(roomId, () => {})
      expect(() => unsub()).not.toThrow()
    })
  })

  describe('onAwarenessUpdate', () => {
    it('fires callback on awareness change', async () => {
      const { roomId } = await createRoom('test-room')

      let called = false
      adapter.onAwarenessUpdate(roomId, () => {
        called = true
      })

      const awareness = adapter.getAwareness(roomId)!
      awareness.setLocalState({ user: 'test' })
      expect(called).toBe(true)
    })

    it('does not fire after unsubscribe', async () => {
      const { roomId } = await createRoom('test-room')

      let callCount = 0
      const unsub = adapter.onAwarenessUpdate(roomId, () => {
        callCount++
      })

      const awareness = adapter.getAwareness(roomId)!
      awareness.setLocalState({ user: 'a' })
      const count1 = callCount

      unsub()
      awareness.setLocalState({ user: 'b' })
      expect(callCount).toBe(count1)
    })
  })

  describe('WebSocket connection', () => {
    it('closes connection to nonexistent room', async () => {
      const client = createClient('no-such-room')
      await client.waitForClose()
    })

    it('sends sync step 1 and step 2 on connect', async () => {
      await createRoom('test-room')

      const client = createClient('test-room')
      await client.waitForOpen()

      const msg1 = await client.nextMessage()
      const decoder1 = decoding.createDecoder(msg1)
      expect(decoding.readVarUint(decoder1)).toBe(MESSAGE_SYNC)

      const msg2 = await client.nextMessage()
      const decoder2 = decoding.createDecoder(msg2)
      expect(decoding.readVarUint(decoder2)).toBe(MESSAGE_SYNC)
    })

    it('syncs server data to client', async () => {
      const { doc: serverDoc } = await createRoom('test-room')
      serverDoc.getArray('items').push(['server-data'])

      const clientDoc = new Doc()
      const client = createClient('test-room')
      await client.waitForOpen()

      const msg1 = await client.nextMessage()
      const dec1 = decoding.createDecoder(msg1)
      decoding.readVarUint(dec1)
      const enc1 = encoding.createEncoder()
      encoding.writeVarUint(enc1, MESSAGE_SYNC)
      syncProtocol.readSyncMessage(dec1, enc1, clientDoc, null)

      const msg2 = await client.nextMessage()
      const dec2 = decoding.createDecoder(msg2)
      decoding.readVarUint(dec2)
      syncProtocol.readSyncMessage(
        dec2,
        encoding.createEncoder(),
        clientDoc,
        null,
      )

      expect(clientDoc.getArray('items').toArray()).toEqual(['server-data'])
    })

    it('broadcasts document updates to connected clients', async () => {
      const { doc: serverDoc } = await createRoom('test-room')

      const client = await connectAndSync('test-room')

      const messagePromise = client.nextMessage()
      serverDoc.getArray('items').push(['new-item'])
      const message = await messagePromise

      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)
      expect(messageType).toBe(MESSAGE_SYNC)
    })

    it('removes awareness on client disconnect', async () => {
      await createRoom('test-room')
      const awareness = adapter.getAwareness(RoomId.from('test-room'))!

      const clientDoc = new Doc()
      const clientAwareness = new Awareness(clientDoc)
      const clientId = clientDoc.clientID

      const client = await connectAndSync('test-room')

      clientAwareness.setLocalState({ user: 'alice' })
      const awarenessEncoder = encoding.createEncoder()
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        awarenessEncoder,
        encodeAwarenessUpdate(clientAwareness, [clientId]),
      )
      client.send(encoding.toUint8Array(awarenessEncoder))

      await wait(50)
      expect(awareness.getStates().has(clientId)).toBe(true)

      client.close()
      await wait(50)

      expect(awareness.getStates().has(clientId)).toBe(false)

      clientAwareness.destroy()
    })

    it('does not crash on malformed binary data', async () => {
      const { doc: serverDoc } = await createRoom('test-room')

      const client = await connectAndSync('test-room')

      client.send(new Uint8Array([255, 255, 255]))
      await wait(50)

      const messagePromise = client.nextMessage()
      serverDoc.getArray('items').push(['after-bad-data'])
      const message = await messagePromise

      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)
      expect(messageType).toBe(MESSAGE_SYNC)
    })

    it('correctly tracks awareness client IDs across multiple clients', async () => {
      await createRoom('test-room')
      const awareness = adapter.getAwareness(RoomId.from('test-room'))!

      // Connect two clients and send awareness updates
      const clientDoc1 = new Doc()
      const clientAwareness1 = new Awareness(clientDoc1)
      const clientId1 = clientDoc1.clientID

      const clientDoc2 = new Doc()
      const clientAwareness2 = new Awareness(clientDoc2)
      const clientId2 = clientDoc2.clientID

      const client1 = await connectAndSync('test-room')
      const client2 = await connectAndSync('test-room')

      // Client 1 sets awareness
      clientAwareness1.setLocalState({ user: 'alice' })
      const enc1 = encoding.createEncoder()
      encoding.writeVarUint(enc1, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        enc1,
        encodeAwarenessUpdate(clientAwareness1, [clientId1]),
      )
      client1.send(encoding.toUint8Array(enc1))

      // Client 2 sets awareness
      clientAwareness2.setLocalState({ user: 'bob' })
      const enc2 = encoding.createEncoder()
      encoding.writeVarUint(enc2, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        enc2,
        encodeAwarenessUpdate(clientAwareness2, [clientId2]),
      )
      client2.send(encoding.toUint8Array(enc2))

      await wait(50)
      expect(awareness.getStates().has(clientId1)).toBe(true)
      expect(awareness.getStates().has(clientId2)).toBe(true)

      // Disconnect client 1 — only client 1's awareness should be removed
      client1.close()
      await wait(50)

      expect(awareness.getStates().has(clientId1)).toBe(false)
      expect(awareness.getStates().has(clientId2)).toBe(true)

      clientAwareness1.destroy()
      clientAwareness2.destroy()
    })

    it('connects to room when URL has query parameters', async () => {
      await createRoom('test-room')

      const client = new BufferedClient(
        `ws://localhost:${port}/test-room?token=abc&foo=bar`,
      )
      clients.push(client)
      await client.waitForOpen()

      const msg = await client.nextMessage()
      const decoder = decoding.createDecoder(msg)
      expect(decoding.readVarUint(decoder)).toBe(MESSAGE_SYNC)
    })
  })
})
