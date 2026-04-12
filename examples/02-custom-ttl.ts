/**
 * Per-room TTL override example.
 *
 * Shows how individual rooms can override the manager's default TTL.
 * Run with: npm run example:custom-ttl
 */
import { WebSocketServer } from 'ws'
import { RoomManager } from 'instant-room'
import { YWebsocketAdapter } from 'instant-room/adapters/y-websocket'

const wss = new WebSocketServer({ port: 0 })
const { port } = wss.address() as { port: number }
const adapter = new YWebsocketAdapter({ wss })

const manager = new RoomManager({
  adapter,
  baseUrl: `ws://localhost:${port}`,
  defaultTtl: '1h',
})

// Uses the manager's default TTL (1 hour)
const defaultRoom = await manager.create()
console.log('default-ttl room  :', defaultRoom.id.toString())

// Short-lived meeting room (30 seconds)
const shortRoom = await manager.create({ ttl: '30s' })
console.log('short-ttl room    :', shortRoom.id.toString())

// Long-lived shared board (1 day)
const longRoom = await manager.create({ ttl: '1d' })
console.log('long-ttl room     :', longRoom.id.toString())

console.log('Active rooms:', manager.list().length)

await manager.destroyAll()
console.log('All rooms destroyed')

adapter.destroy()
wss.close()
