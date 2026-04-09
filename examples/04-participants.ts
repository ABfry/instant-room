/**
 * Participant join / leave / update tracking.
 *
 * Starts a server with a single room and subscribes to participant
 * events. Connect a Yjs client (e.g. y-websocket) to the printed URL
 * to see events fire.
 *
 * Run with: npm run example:participants
 * Press Ctrl+C to stop.
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
  defaultTtl: '10m',
})

const room = await manager.create()
console.log(`Room ready at: ${room.url}`)
console.log('Waiting for participants... (Ctrl+C to stop)')

const unsubJoin = room.onJoin((participant) => {
  console.log(
    `[join]   clientId=${participant.clientId} state=${JSON.stringify(participant.data)}`,
  )
})

const unsubLeave = room.onLeave((clientId) => {
  console.log(`[leave]  clientId=${clientId}`)
})

const unsubUpdate = room.onUpdate((participant) => {
  console.log(
    `[update] clientId=${participant.clientId} state=${JSON.stringify(participant.data)}`,
  )
})

process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  unsubJoin()
  unsubLeave()
  unsubUpdate()
  await manager.destroyAll()
  adapter.destroy()
  wss.close()
  process.exit(0)
})
