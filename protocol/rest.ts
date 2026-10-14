// HTTP API contracts: client <-> backend (angel-bot)
import type { User, Item, UserItem, Room, GameID, UserID, RoomID, ItemID } from './models';

// ---------- /rooms ----------
export interface CreateRoomReq {
  game_id: GameID;
  players: UserID[];
}
export interface CreateRoomRes {
  room_id: RoomID;
}

export interface ListRoomsRes {
  rooms: Room[];
}

// ---------- /profile ----------
export interface GetProfileRes {
  user: User;
}

export interface UpdateProfileReq {
  username?: string;
  avatar_url?: string;
}

// ---------- /items & /shop ----------
export interface ListItemsRes {
  items: Item[];
}

export interface MyItemsRes {
  items: UserItem[];
}

export interface BuyItemReq {
  item_id: ItemID;
  currency: 'coins' | 'gems';
}
export interface BuyItemRes {
  ok: boolean;
  balance: number;
}

// ---------- /chat ----------
export interface SendChatReq {
  room_id: RoomID;
  text: string;
}
export interface SendChatRes {
  ok: boolean;
  msg_id: string;
}

// ---------- /admin/metrics ----------
export interface RealtimeStats {
  online: number;
  rooms: number;
  active_matches: number;
}

export interface DailyStats {
  date: string;
  players: number;
  matches: number;
  avg_duration_sec: number;
}

export interface PeriodStats {
  from: string;
  to: string;
  players: number;
  matches: number;
  new_users: number;
}
