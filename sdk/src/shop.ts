import type { AngelClient } from './client';
import type { BuyItemReq, BuyItemRes } from '../../protocol/rest';
import type { ItemID } from '../../protocol/models';

export class ShopApi {
  constructor(private c: AngelClient) {}

  async buy(itemId: ItemID, currency: 'coins' | 'gems' = 'coins'): Promise<BuyItemRes> {
    return this.c.http<BuyItemRes>('/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId, currency })
    });
  }

  async equip(itemId: ItemID): Promise<void> {
    await this.c.http('/shop/equip', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId })
    });
  }
}
