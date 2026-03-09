/** A connected user in a room */
export interface Participant {
  clientId: number
  data: Record<string, unknown>
}
