export interface LudoState {
  schema: 1
  seats: string[]
  board: number[]
  turn: number
  dice: number
  sixes: number
  winner: number
  teams: boolean
  started: boolean
  legal: number[]
}

export interface Frame {
  type: string
  roomId?: string
  gameId?: string
  rev: number
  state?: unknown
  event?: { type: string, payload?: unknown }
  error?: { code: string, error: string }
}

export interface Client {
  connect(): Promise<void>
  command(type: string, payload?: unknown): void
  on(type: string, handler: (frame: Frame) => void): () => void
  close(): void
}

export type ClientFactory = (
  url: string,
  room: string,
  user: string
) => Promise<Client>

export function decodeState(value: unknown): LudoState | null {
  if (!value || typeof value !== 'object') return null

  const wrapper = value as Record<string, unknown>
  if ('data' in wrapper) return decodeState(wrapper.data)

  const s = value as LudoState
  if (
    s.schema !== 1 ||
    !Array.isArray(s.seats) ||
    !Array.isArray(s.board)
  ) return null

  const count = s.seats.length
  if (
    count < 2 ||
    count > 4 ||
    new Set(s.seats).size !== count
  ) return null

  if (!s.seats.every(
    id => typeof id === 'string' && id.length > 0
  )) return null

  if (
    s.board.length !== 16 ||
    !s.board.every(
      p => Number.isInteger(p) && p >= -1 && p <= 56
    )
  ) return null

  if (
    !Number.isInteger(s.turn) ||
    s.turn < 0 ||
    s.turn >= count
  ) return null

  if (
    !Number.isInteger(s.dice) ||
    s.dice < 0 ||
    s.dice > 6
  ) return null

  if (
    !Number.isInteger(s.sixes) ||
    s.sixes < 0 ||
    s.sixes > 2
  ) return null

  if (
    !Number.isInteger(s.winner) ||
    s.winner < -1 ||
    s.winner >= count
  ) return null

  if (
    typeof s.teams !== 'boolean' ||
    typeof s.started !== 'boolean'
  ) return null

  if (s.teams && count !== 4) return null

  if (
    !Array.isArray(s.legal) ||
    !s.legal.every(
      t => Number.isInteger(t) && t >= 0 && t < 4
    )
  ) return null

  if (new Set(s.legal).size !== s.legal.length) return null

  return structuredClone(s)
}

export function colorIndex(count: number, seat: number): number {
  return count === 2 ? seat * 2 : seat
}

// Decorative layout only; never used as authoritative game state.
export function previewState(): LudoState {
  return {
    schema: 1,
    seats: ['سبز', 'طلایی', 'آبی', 'مرجانی'],
    board: Array(16).fill(-1),
    turn: 0,
    dice: 0,
    sixes: 0,
    winner: -1,
    teams: false,
    started: false,
    legal: []
  }
}
