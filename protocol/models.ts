export type UserID = string;
export type RoomID = string;
export type GameID = string;
export type ItemID = string;

export type Platform = 'telegram' | 'bale' | 'web';

export interface User {
  id: UserID;
  uuid: string;
  username: string;
  platform: Platform;
  coins: number;
  gems: number;
  level: number;
  avatar_url?: string;
  created_at: string;
}

export interface Item {
  id: ItemID;
  name: string;
  kind: 'frame' | 'bubble' | 'badge' | 'banner';
  price_coins: number;
  price_gems: number;
  preview_url: string;
  available: boolean;
}

export interface UserItem {
  user_id: UserID;
  item_id: ItemID;
  acquired_at: string;
  equipped: boolean;
}

export interface Room {
  id: RoomID;
  game_id: GameID;
  host_id: UserID;
  players: UserID[];
  status: 'lobby' | 'countdown' | 'active' | 'finished' | 'aborted';
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: RoomID;
  from: UserID;
  text: string;
  ts: string;
}
