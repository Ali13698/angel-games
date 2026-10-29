# Ludo WASM tests

## Toolchain

- Go 1.27
- Node.js 22

## Run

After generating shared protocol bindings and building the game,
run from the repository root:

    node --test ludo-light/scripts/wasm.test.mjs

Run Go rule tests from ludo-light:

    go test ./...

## Runtime coverage

The Node test host:

1. Loads the compiled WASI reactor.
2. Initializes it through WASI.
3. Writes JSON inputs into exported memory.
4. Calls reset, allocate and apply.
5. Reads the little-endian length-prefixed JSON result.

Tests cover:

- Initial two-player state.
- Snapshot event contents.
- Rejection of outsider commands.
- Rejection of wrong-turn rolls.
- Rejection of unknown commands.
- A real WASI-backed dice roll.
- Four-seat team configuration.
- Repeated calls to the same instance.

Go rejection tests also check that rejected commands preserve
the input state and do not consume randomness.

## Limits

This is a local integration test host, not the production server.

It does not verify:

- Production host initialization.
- Authentication or WebSocket transport.
- Reconnection and persistence.
- Simultaneous commands.
- Real two-player browser sessions.
- Complete gameplay or statistical fairness.

The production host must authenticate the command sender.
Client-provided sender identifiers must not be trusted.

Node WASI is used only for trusted repository build output here.
It is not a security sandbox for arbitrary uploaded modules.
