import type { AngelClient } from './client';
import type { SendChatRes } from '@angel/protocol/rest';
import type { RoomID, ChatMessage } from '@angel/protocol/models';

export class ChatApi {
  constructor(private c: AngelClient) {}

  send(roomId: RoomID, text: string): void {
    this.c.send({ type: 'chat', payload: { text } });
  }

  async sendRest(roomId: RoomID, text: string): Promise<SendChatRes> {
    return this.c.http<SendChatRes>('/chat', {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId, text })
    });
  }

  onMessage(h: (msg: ChatMessage) => void): () => void {
    return this.c.on('chat.message', (ev) => h(ev.payload as ChatMessage));
  }
}
