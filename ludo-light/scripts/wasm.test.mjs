import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { openGame } from '../../scripts/wasm-test-host.mjs'

const wasmPath = fileURLToPath(
  new URL('../dist/game.wasm', import.meta.url)
)

function intent(from, type, payload = {}) {
  return {
    from,
    cmd: { type, payload }
  }
}

test('WASM initializes a two-player game', async () => {
  const game = await openGame(wasmPath)

  const result = game.apply(
    { seats: ['alice', 'bob'] },
    intent('alice', 'sync')
  )

  assert.ok(result)
  assert.equal(result.state.schema, 1)
  assert.equal(result.state.winner, -1)
  assert.equal(result.state.turn, 0)
  assert.equal(result.state.dice, 0)
  assert.equal(result.state.started, false)
  assert.deepEqual(result.state.board, Array(16).fill(-1))
  assert.deepEqual(result.state.legal, [])

  const snapshot = result.events.find(
    event => event.type === 'ludo.snapshot'
  )

  assert.ok(snapshot)
  assert.deepEqual(snapshot.payload, result.state)
})

test('WASM rejects an outsider and a wrong-turn roll', async () => {
  const game = await openGame(wasmPath)

  const result = game.apply(
    { seats: ['alice', 'bob'] },
    intent('alice', 'sync')
  )

  assert.ok(result)

  assert.equal(
    game.apply(result.state, intent('mallory', 'sync')),
    null
  )

  assert.equal(
    game.apply(result.state, intent('bob', 'roll')),
    null
  )

  assert.equal(
    game.apply(result.state, intent('alice', 'unknown')),
    null
  )
})

test('WASM rolls using the WASI random source', async () => {
  const game = await openGame(wasmPath)

  const result = game.apply(
    { seats: ['alice', 'bob'] },
    intent('alice', 'roll')
  )

  assert.ok(result)
  assert.equal(result.state.started, true)

  const rolled = result.events.find(
    event => event.type === 'game.rolled'
  )

  assert.ok(rolled)
  assert.equal(rolled.payload.seat, 0)
  assert.ok(Number.isInteger(rolled.payload.dice))
  assert.ok(rolled.payload.dice >= 1)
  assert.ok(rolled.payload.dice <= 6)

  if (rolled.payload.dice === 6) {
    assert.equal(result.state.turn, 0)
    assert.equal(result.state.dice, 6)
    assert.deepEqual(result.state.legal, [0, 1, 2, 3])
  } else {
    assert.equal(result.state.turn, 1)
    assert.equal(result.state.dice, 0)
    assert.deepEqual(result.state.legal, [])
  }
})

test('WASM accepts team configuration for four seats', async () => {
  const game = await openGame(wasmPath)

  const result = game.apply(
    { seats: ['alice', 'bob', 'carol', 'dave'] },
    intent('alice', 'configure', { teams: true })
  )

  assert.ok(result)
  assert.equal(result.state.teams, true)
})

test('WASM handles repeated calls with reset', async () => {
  const game = await openGame(wasmPath)
  let state = { seats: ['alice', 'bob'] }

  for (let index = 0; index < 100; index++) {
    const result = game.apply(
      state,
      intent('alice', 'sync')
    )

    assert.ok(result)
    assert.equal(result.state.schema, 1)
    assert.equal(result.state.winner, -1)
    state = result.state
  }
})
