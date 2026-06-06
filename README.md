# instant-room

> Ephemeral collaboration rooms — just share a URL

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

instant-room creates short-lived, real-time collaboration rooms backed by [Yjs](https://github.com/yjs/yjs) CRDTs. Rooms expire automatically after a TTL of inactivity, track connected participants via Awareness, and sync over a pluggable provider adapter.

## Features

- **Auto-expiring rooms** — each room has a TTL that resets on activity and self-destructs when idle
- **Participant tracking** — join / leave / update events via Yjs Awareness
- **CRDT sync** — conflict-free real-time updates powered by Yjs
- **Pluggable transport** — swap providers behind the `ProviderAdapter` port (ships with a WebSocket adapter)
- **Hexagonal design** — domain / application / infrastructure layers with no framework lock-in

## Installation

```bash
npm install instant-room yjs y-protocols
```

`yjs` and `y-protocols` are peer dependencies. The bundled WebSocket adapter additionally needs `ws`:

```bash
npm install ws
```

`ws` is only required when you use the `instant-room/adapters/y-websocket` subpath.

## Quick Start

```ts
import { WebSocketServer } from 'ws'
import { RoomManager } from 'instant-room'
import { YWebsocketAdapter } from 'instant-room/adapters/y-websocket'

const wss = new WebSocketServer({ port: 1234 })
const adapter = new YWebsocketAdapter({ wss })

const manager = new RoomManager({
  adapter,
  baseUrl: 'ws://localhost:1234',
  defaultTtl: '1h',
})

const room = await manager.create()
console.log('Share this URL:', room.url) // ws://localhost:1234/<roomId>

// later, when finished
await manager.destroy(room.id)
adapter.destroy()
wss.close()
```

## Usage

### Custom TTL

TTL strings use the [`ms`](https://github.com/vercel/ms) format (`'30s'`, `'10m'`, `'1h'`, `'1d'`). Set a default on the manager, or override per room.

```ts
const manager = new RoomManager({ adapter, baseUrl, defaultTtl: '1h' })

const shortLived = await manager.create({ ttl: '30s' })
const longLived = await manager.create({ ttl: '1d' })
```

### Expiration handlers

A room destroys itself when its TTL elapses. Hook into that with a default handler or a per-room override.

```ts
const manager = new RoomManager({
  adapter,
  baseUrl,
  defaultTtl: '2s',
  defaultOnExpire: (roomId) => console.log(`${roomId} expired`),
})

await manager.create({
  ttl: '4s',
  onExpire: (roomId) => console.log(`${roomId} expired (custom)`),
})
```

### Participant events

Participant events fire as Yjs clients connect to `room.url` and set their Awareness state. Use any Yjs WebSocket provider (e.g. `y-websocket`) on the client side.

```ts
const room = await manager.create()

const unsubJoin = room.onJoin((p) => console.log('join', p.clientId, p.data))
const unsubLeave = room.onLeave((clientId) => console.log('leave', clientId))
const unsubUpdate = room.onUpdate((p) => console.log('update', p.clientId, p.data))

console.log('current participants:', room.getParticipants())

// each subscription returns an unsubscribe function
unsubJoin()
unsubLeave()
unsubUpdate()
```

### Extending the TTL manually

```ts
room.touch() // resets the TTL timer without document activity
```

## API Reference

### `RoomManager`

Assembles and manages room lifecycle.

```ts
new RoomManager(config: RoomManagerConfig)
```

`RoomManagerConfig`:

| Field | Type | Description |
| --- | --- | --- |
| `adapter` | `ProviderAdapter` | Transport provider |
| `baseUrl` | `string` | Base URL used to build room URLs |
| `defaultTtl` | `string` | Default TTL (`ms` format) |
| `defaultOnExpire?` | `(roomId: RoomId) => void` | Default expiration handler |

| Method | Returns | Description |
| --- | --- | --- |
| `create(options?: { ttl?: string; onExpire?: (roomId: RoomId) => void })` | `Promise<Room>` | Create a room, optionally overriding TTL / handler |
| `get(roomId: RoomId)` | `Room \| undefined` | Look up an active room |
| `list()` | `Room[]` | All active rooms |
| `destroy(roomId: RoomId)` | `Promise<void>` | Destroy one room |
| `destroyAll()` | `Promise<void>` | Destroy every room |

### `Room`

A single room integrating TTL, Awareness, and the provider.

| Member | Type | Description |
| --- | --- | --- |
| `id` | `RoomId` | Room identifier |
| `url` | `string` | Shareable room URL |
| `ydoc` | `Y.Doc` | Underlying Yjs document |
| `getParticipants()` | `Participant[]` | Currently connected participants |
| `onJoin(cb)` | `() => void` | Subscribe to joins; returns unsubscribe |
| `onLeave(cb)` | `() => void` | Subscribe to leaves; returns unsubscribe |
| `onUpdate(cb)` | `() => void` | Subscribe to state updates; returns unsubscribe |
| `onDocUpdate(cb)` | `() => void` | Subscribe to document updates; returns unsubscribe |
| `touch()` | `void` | Reset the TTL timer |
| `destroy()` | `Promise<void>` | Destroy the room and release resources |

### `RoomId`

Value object for room identifiers.

| Member | Returns | Description |
| --- | --- | --- |
| `RoomId.generate(length?)` | `RoomId` | New random ID (default length 12) |
| `RoomId.from(value)` | `RoomId` | Restore from a string |
| `buildUrl(baseUrl)` | `string` | Build the full room URL |
| `toString()` | `string` | Raw string value |
| `equals(other)` | `boolean` | Value equality |

### `Participant`

```ts
interface Participant {
  clientId: number
  data: Record<string, unknown>
}
```

### `ProviderAdapter`

Port interface for transport providers. Implement this to plug in a custom backend.

```ts
interface ProviderAdapter {
  createRoom(roomId: RoomId, ydoc: Y.Doc): Promise<Awareness>
  destroyRoom(roomId: RoomId): Promise<void>
  getAwareness(roomId: RoomId): Awareness | null
  onDocUpdate(roomId: RoomId, callback: () => void): () => void
  onAwarenessUpdate(roomId: RoomId, callback: () => void): () => void
}
```

### `YWebsocketAdapter`

WebSocket provider adapter based on `y-protocols`. Imported from the `instant-room/adapters/y-websocket` subpath.

```ts
new YWebsocketAdapter(config: YWebsocketAdapterConfig)
```

`YWebsocketAdapterConfig`:

| Field | Type | Description |
| --- | --- | --- |
| `wss` | `WebSocketServer` | A `ws` server instance |
| `roomNameFromRequest?` | `(req: IncomingMessage) => string \| null` | Extract room name from request (default: last URL path segment) |

Call `adapter.destroy()` to detach the WebSocket connection handler. Rooms themselves are torn down via `manager.destroy()` / `manager.destroyAll()` (or `adapter.destroyRoom()`).

## Architecture

instant-room follows a hexagonal (ports & adapters) layout:

- **domain** — entities (`Room`, `AwarenessWrapper`, `TtlTimer`), value objects (`RoomId`, `Ttl`), and the `ProviderAdapter` port
- **application** — `RoomManager` orchestrates room lifecycle
- **infrastructure** — adapters implementing the port (e.g. `YWebsocketAdapter`)

Because transport lives behind the `ProviderAdapter` port, you can swap WebSocket for any other provider without touching domain logic.

## Examples

Runnable examples live in [`examples/`](./examples):

```bash
npm run example:basic           # create / inspect / destroy a room
npm run example:custom-ttl      # per-room TTL overrides
npm run example:ttl-expiration  # expiration handlers
npm run example:participants    # join / leave / update events
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
