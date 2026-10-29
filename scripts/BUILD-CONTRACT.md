# Game build contract

## Discovery

The catalog scanner discovers game directories by game.json.

A directory without game.json is not built.

The build orchestrator must not contain game names or game rules.

## Toolchain

The CI Go version is 1.27.
The CI Node.js version is 22.

## Package scripts

Each discovered game must provide these package.json scripts:

- test:go: run the game's Go tests.
- build:release: build the browser assets and WASI reactor.

The game owns the implementation of these scripts.

Dependencies are installed with npm install --ignore-scripts.
Required generation steps must be invoked explicitly.

## Shared protocol

Generate the shared Protobuf bindings before building games:

    npm run protocol:generate

Online clients use @angel/sdk and the shared protocol.

## Build

From the repository root:

    node scripts/build-games.mjs
    node scripts/release-catalog.mjs

Build scripts execute repository code.
Only run them for repositories you trust.

## WASM checks

The current angel-apply-v1 reactor must export:

- memory
- _initialize
- reset
- allocate
- apply

A command-style _start export is rejected.

These checks validate compilation and export names.
They do not prove ABI function signatures or host compatibility.

## Catalog

catalog-release.json records the manifest metadata,
artifact paths, byte sizes and SHA-256 hashes of the
WASM and HTML entry files.

These hashes do not cover every browser asset.
They are integrity metadata, not digital signatures.

## CI output

GitHub Actions retains the catalog and dist directories.
This does not deploy files to the game server.

## Online acceptance

A green build does not prove online multiplayer works.
Host initialization, command handling, reconnect behavior
and a real two-player session still need integration tests.

The current host is not automatically converted into
a catalog-driven loader by these scripts.
