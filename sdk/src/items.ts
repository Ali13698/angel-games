import type { AngelClient } from './client';
import type { ListItemsRes, MyItemsRes } from '../../protocol/rest';
import type { Item, UserItem } from '../../protocol/models';

export class ItemsApi {
  constructor(private c: AngelClient) {}

  async all(): Promise<Item[]> {
    const r = await this.c.http<ListItemsRes>('/items');
    return r.items;
  }

  async mine(): Promise<UserItem[]> {
    const r = await this.c.http<MyItemsRes>('/items/mine');
    return r.items;
  }
}
