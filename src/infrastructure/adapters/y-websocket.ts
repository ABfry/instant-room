/**
 * WebSocket adapter based on y-protocols
 *
 * Implements the ProviderAdapter interface to synchronize
 * Yjs documents and share Awareness state over WebSocket.
 *
 * To prevent duplicate document management, use y-protocols (sync / awareness) directly instead of @y/websocket-server.
 */

import type { IncomingMessage } from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import { Doc } from 'yjs'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import type { RoomId } from '../../domain/value-objects/room-id.js'
import type { ProviderAdapter } from '../../domain/ports/adapter.js'

// ============================================================================
// Message type constants
// ============================================================================

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

// ============================================================================
// Internal types
// ============================================================================

interface RoomState {
  doc: Doc
  awareness: Awareness
  conns: Map<WebSocket, Set<number>>
  docUpdateHandler: (update: Uint8Array, origin: unknown) => void
  awarenessChangeHandler: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => void
}

/** Configuration for YWebsocketAdapter */
export interface YWebsocketAdapterConfig {
  /** WebSocket server instance */
  wss: WebSocketServer
  /** Extract room name from request (default: last segment of URL path) */
  roomNameFromRequest?: (req: IncomingMessage) => string | null
}

// ============================================================================
// YWebsocketAdapter
// ============================================================================

/** WebSocket provider adapter based on y-protocols */
export class YWebsocketAdapter implements ProviderAdapter {
  private readonly rooms = new Map<string, RoomState>()
  private readonly wss: WebSocketServer
  private readonly roomNameFromRequest: (req: IncomingMessage) => string | null
  private readonly connectionHandler: (
    ws: WebSocket,
    req: IncomingMessage,
  ) => void

  constructor(config: YWebsocketAdapterConfig) {
    this.wss = config.wss
    this.roomNameFromRequest =
      config.roomNameFromRequest ?? defaultRoomNameFromRequest

    this.connectionHandler = (ws, req) => this.handleConnection(ws, req)
    this.wss.on('connection', this.connectionHandler)
  }

  async createRoom(roomId: RoomId, ydoc: Doc): Promise<void> {
    const name = roomId.toString()
    if (this.rooms.has(name)) return

    const awareness = new Awareness(ydoc)

    const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
      const room = this.rooms.get(name)
      if (!room) return
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      const message = encoding.toUint8Array(encoder)
      broadcastToRoom(
        room,
        message,
        origin instanceof WebSocket ? origin : null,
      )
    }

    const awarenessChangeHandler = (
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      const room = this.rooms.get(name)
      if (!room) return
      const changedClients = [
        ...changes.added,
        ...changes.updated,
        ...changes.removed,
      ]
      if (changedClients.length === 0) return
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        encoder,
        encodeAwarenessUpdate(awareness, changedClients),
      )
      const message = encoding.toUint8Array(encoder)
      broadcastToRoom(
        room,
        message,
        origin instanceof WebSocket ? origin : null,
      )
    }

    ydoc.on('update', docUpdateHandler)
    awareness.on('update', awarenessChangeHandler)

    this.rooms.set(name, {
      doc: ydoc,
      awareness,
      conns: new Map(),
      docUpdateHandler,
      awarenessChangeHandler,
    })
  }

  async destroyRoom(roomId: RoomId): Promise<void> {
    const name = roomId.toString()
    const room = this.rooms.get(name)
    if (!room) return

    for (const ws of room.conns.keys()) {
      ws.close()
    }
    room.conns.clear()

    room.doc.off('update', room.docUpdateHandler)
    room.awareness.off('update', room.awarenessChangeHandler)
    room.awareness.destroy()
    this.rooms.delete(name)
  }

  getAwareness(roomId: RoomId): Awareness | null {
    return this.rooms.get(roomId.toString())?.awareness ?? null
  }

  onDocUpdate(roomId: RoomId, callback: () => void): () => void {
    const room = this.rooms.get(roomId.toString())
    if (!room) return () => {}
    const handler = () => callback()
    room.doc.on('update', handler)
    return () => room.doc.off('update', handler)
  }

  onAwarenessUpdate(roomId: RoomId, callback: () => void): () => void {
    const room = this.rooms.get(roomId.toString())
    if (!room) return () => {}
    const handler = () => callback()
    room.awareness.on('update', handler)
    return () => room.awareness.off('update', handler)
  }

  /** Remove the connection listener from the WebSocket server */
  destroy(): void {
    this.wss.off('connection', this.connectionHandler)
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const roomName = this.roomNameFromRequest(req)
    if (!roomName) {
      ws.close()
      return
    }

    const room = this.rooms.get(roomName)
    if (!room) {
      ws.close()
      return
    }

    room.conns.set(ws, new Set())

    ws.on('message', (data: ArrayLike<number>) => {
      this.handleMessage(room, ws, new Uint8Array(data))
    })

    ws.on('close', () => {
      this.handleClose(room, ws)
    })

    // Send server's state vector
    {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeSyncStep1(encoder, room.doc)
      send(ws, encoding.toUint8Array(encoder))
    }

    // Send server's full document state
    {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeSyncStep2(encoder, room.doc)
      send(ws, encoding.toUint8Array(encoder))
    }

    // Send awareness states
    {
      const states = room.awareness.getStates()
      if (states.size > 0) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
        encoding.writeVarUint8Array(
          encoder,
          encodeAwarenessUpdate(room.awareness, [...states.keys()]),
        )
        send(ws, encoding.toUint8Array(encoder))
      }
    }
  }

  private handleMessage(
    room: RoomState,
    ws: WebSocket,
    data: Uint8Array,
  ): void {
    try {
      const decoder = decoding.createDecoder(data)
      const messageType = decoding.readVarUint(decoder)

      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder()
          encoding.writeVarUint(encoder, MESSAGE_SYNC)
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws)
          if (encoding.length(encoder) > 1) {
            send(ws, encoding.toUint8Array(encoder))
          }
          break
        }
        case MESSAGE_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder)
          applyAwarenessUpdate(room.awareness, update, ws)
          // Track awareness client IDs managed by this connection
          const connAwareness = room.conns.get(ws)
          if (connAwareness) {
            const awarenessDecoder = decoding.createDecoder(update)
            const len = decoding.readVarUint(awarenessDecoder)
            for (let i = 0; i < len; i++) {
              const clientId = decoding.readVarUint(awarenessDecoder)
              decoding.readVarUint(awarenessDecoder) // skip clock
              decoding.readVarString(awarenessDecoder) // skip state
              connAwareness.add(clientId)
            }
          }
          break
        }
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }

  private handleClose(room: RoomState, ws: WebSocket): void {
    const controlledIds = room.conns.get(ws)
    if (controlledIds && controlledIds.size > 0) {
      removeAwarenessStates(room.awareness, [...controlledIds], null)
    }
    room.conns.delete(ws)
  }
}

// ============================================================================
// Helper functions
// ============================================================================

function defaultRoomNameFromRequest(req: IncomingMessage): string | null {
  if (!req.url) return null
  const urlWithoutQuery = req.url.split('?')[0]
  const segments = urlWithoutQuery.split('/').filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : null
}

function send(ws: WebSocket, message: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message)
  }
}

function broadcastToRoom(
  room: RoomState,
  message: Uint8Array,
  exclude: WebSocket | null,
): void {
  for (const ws of room.conns.keys()) {
    if (ws !== exclude) {
      send(ws, message)
    }
  }
}
