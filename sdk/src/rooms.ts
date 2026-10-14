import type { AngelClient } from './client';
import type { CreateRoomReq, CreateRoomRes, ListRoomsRes } from '../../protocol/rest';
import type { GameID, UserID, RoomID } from '../../protocol/models';

export class RoomsApi {
  constructor(private c: AngelClient) {}

  async create(gameId: GameID, players: UserID[] = []): Promise<RoomID> {
    const r = await this.c.createRoom(gameId, players);
    return r.room_id;
  }

  async list(): Promise<ListRoomsRes> {
    return this.c.http<ListRoomsRes>('/rooms');
  }

  leave(): void {
    this.c.send({ type: 'leave' });
  }
}

declare module './client' {
  interface AngelClient {
    createRoom(gameId: GameID, players: UserID[]): Promise<CreateRoomRes>;
  }
}
