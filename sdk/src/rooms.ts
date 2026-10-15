import type { AngelClient } from './client';
import type { ListRoomsRes } from '@angel/protocol/rest';
import type { GameID, UserID, RoomID } from '@angel/protocol/models';

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
