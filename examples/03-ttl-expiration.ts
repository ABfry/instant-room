/**
 * TTL expiration and onExpire callbacks.
 *
 * Demonstrates both the manager-level default onExpire and per-room
 * onExpire override. Rooms are auto-destroyed when their TTL elapses.
 * Run with: npm run example:ttl-expiration
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
  defaultTtl: '2s',
  defaultOnExpire: (roomId) => {
    console.log(`[default] room ${roomId.toString()} expired`)
  },
})

// Room A: relies on defaultTtl (2s) and defaultOnExpire
const roomA = await manager.create()
console.log(`created room A: ${roomA.id.toString()} (ttl 2s, default handler)`)

// Room B: overrides both ttl and onExpire
const roomB = await manager.create({
  ttl: '4s',
  onExpire: (roomId) => {
    console.log(`[per-room] room ${roomId.toString()} expired (custom handler)`)
  },
})
console.log(`created room B: ${roomB.id.toString()} (ttl 4s, custom handler)`)

console.log('Waiting 5s for expirations...')
await new Promise((resolve) => setTimeout(resolve, 5000))

console.log('Remaining rooms:', manager.list().length)

await manager.destroyAll()
adapter.destroy()
wss.close()
