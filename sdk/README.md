# @angel/sdk

Thin client library for connecting Angel games to the backend (`angel-bot`) and engine (`angel-go`).

## Usage

```ts
import { AngelClient } from '@angel/sdk';

const client = new AngelClient({
  httpBase: 'https://nomi98.com',
  wsBase: 'wss://game.nomi98.com',
  token: 'user-jwt-or-session'
});

await client.connect('ludo', roomId);
client.on('ludo.rolled', (e) => { /* ... */ });

await client.rooms.create('ludo');
await client.chat.send(roomId, 'hi');
const profile = await client.profile.get();
