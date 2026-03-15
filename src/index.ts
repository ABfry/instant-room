// Application
export { RoomManager } from './application/room-manager.js'
export type { RoomManagerConfig } from './application/room-manager.js'

// Domain entities
export { Room } from './domain/entities/room.js'

// Domain types
export type { Participant } from './domain/types/index.js'

// Domain ports
export type { ProviderAdapter } from './domain/ports/adapter.js'

// Domain value objects
export { RoomId } from './domain/value-objects/room-id.js'

// Domain errors
export { RoomNotFoundError, RoomExpiredError } from './domain/errors.js'
