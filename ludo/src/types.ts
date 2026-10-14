export type LudoState = {
  rev: number;
  seats: string[];
  tokens: number[];
  turn: number;
  die: number;
  done: boolean;
  winner: number;
};

export type WireMsg =
  | { type: 'joined'; room_id: string; game_id: string; rev: number; state: LudoState }
  | { type: 'event'; event: { type: string; payload: any } }
  | { type: 'error'; code: string; error: string };

export const COLORS = [0xff5267, 0x36d99b, 0xffc94e, 0x4b9dff];
export const TOKENS_PER_SEAT = 4;
export const BOARD_SIZE = 15;
export const CELL = 40;
