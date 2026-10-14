# Protocol

Shared TypeScript types and contracts between Angel games and the engine.

## Files
- `wire.ts` — WebSocket message types
- `rest.ts` — HTTP API contracts
- `models.ts` — Core domain models (User, Item, Room, etc.)

Any game in this repo imports from here. **Never modify without team-wide agreement** — it's a breaking change.
