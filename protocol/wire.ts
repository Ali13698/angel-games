// WebSocket messages: client <-> engine (angel-go)

// ---------- Client -> Server ----------
export type ClientMsg =
  | { type: 'join'; room_id: string; id?: string; rev?: number }
  | { type: 'leave'; id?: string }
  | { type: 'state'; id?: string }
  | { type: 'roll'; id?: string; rev?: number }
  | { type: 'move'; id?: string; rev?: number; payload: { token: number } }
  | { type: 'chat'; id?: string; payload: { text: string } }
  | { type: 'ping'; id?: string };

// ---------- Server -> Client ----------
export type ServerMsg =
  | { type: 'joined'; room_id: string; game_id: string; rev: number; state: any }
  | { type: 'event'; room_id: string; game_id: string; rev: number; event: GameEvent }
  | { type: 'pong'; id?: string }
  | { type: 'error'; code: string; error: string; id?: string };

export interface GameEvent {
  event_id: string;
  stream_id: string;
  seq: number;
  type: string;
  payload: any;
}

// ---------- Error codes ----------
export const ErrorCode = {
  BadFrame: 'bad_frame',
  NoRoom: 'no_room',
  RoomFull: 'room_full',
  NotJoined: 'not_joined',
  AlreadyJoined: 'already_joined',
  UnknownGame: 'unknown_game',
  ServerClosed: 'server_closed',
  WrongPhase: 'wrong_phase',
  StaleVersion: 'stale_version',
  Busy: 'busy',
  Backpressure: 'backpressure'
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];
