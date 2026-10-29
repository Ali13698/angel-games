import type { Client, ClientFactory } from './model.ts'

// The host supplies a locally bundled @angel/sdk through an import map.
// No CDN or custom WebSocket codec is used.
export const sdkFactory: ClientFactory = async (
  url,
  room,
  user
) => {
  const packageName = '@angel/sdk'
  const sdk = await import(packageName)

  if (typeof sdk.AngelClient !== 'function') {
    throw new Error('SDK unavailable')
  }

  return new sdk.AngelClient(url, room, user) as Client
}
