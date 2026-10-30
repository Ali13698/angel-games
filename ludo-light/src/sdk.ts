import type { Client, ClientFactory } from './model.ts';

export const sdkFactory: ClientFactory = async (url, room, user) => {
  const endpoint = new URL(url);
  const expectedProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

  if (
    endpoint.host !== location.host ||
    endpoint.protocol !== expectedProtocol ||
    endpoint.pathname !== '/ws'
  ) {
    throw new Error('Only this host game endpoint is allowed');
  }

  const raw = sessionStorage.getItem('angel.ludo.connection.v1');
  if (!raw) throw new Error('Enter through the lobby first');

  const connection = JSON.parse(raw) as {
    room?: string;
    user?: string;
    ticket?: string;
    expires?: number;
  };

  if (
    connection.room !== room ||
    connection.user !== user ||
    typeof connection.ticket !== 'string' ||
    !/^[a-f0-9]{64}$/.test(connection.ticket) ||
    typeof connection.expires !== 'number' ||
    connection.expires <= Date.now()
  ) {
    throw new Error('Game permission is missing or expired');
  }

  endpoint.search = '';
  endpoint.hash = connection.ticket;

  const packageName = '@angel/sdk';
  const sdk = await import(packageName);

  if (typeof sdk.AngelClient !== 'function') {
    throw new Error('SDK unavailable');
  }

  return new sdk.AngelClient(endpoint.href, room, user) as Client;
};
