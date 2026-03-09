/** Thrown when a room with the given ID does not exist */
export class RoomNotFoundError extends Error {
  constructor(roomId: string) {
    super(`Room not found: ${roomId}`)
    this.name = 'RoomNotFoundError'
  }
}

/** Thrown when a room has already expired */
export class RoomExpiredError extends Error {
  constructor(roomId: string) {
    super(`Room expired: ${roomId}`)
    this.name = 'RoomExpiredError'
  }
}
