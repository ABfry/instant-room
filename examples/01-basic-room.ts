/**
 * Basic room lifecycle example.
 *
 * Demonstrates creating a room, inspecting it, and destroying it.
 * Run with: npm run example:basic
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

const room = await manager.create()
console.log('Created room')
console.log('  id :', room.id.toString())
console.log('  url:', room.url)

console.log('Active rooms:', manager.list().length)

const retrieved = manager.get(room.id)
console.log('Retrieved by id matches:', retrieved?.id.equals(room.id))

await manager.destroy(room.id)
console.log('Destroyed. Active rooms:', manager.list().length)

adapter.destroy()
wss.close()
