import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import protobuf from 'protobufjs'

if (!process.env.WIRE_BUNDLE) {
  throw new Error('WIRE_BUNDLE must point to the bundled wire module')
}

const { encodeClient, decodeServer } = await import(
  pathToFileURL(process.env.WIRE_BUNDLE).href
)

const schema = protobuf.parse(`
  syntax = "proto3";
  package angel;

  message ClientMsg {
    string type = 1;
    string id = 2;
    string room_id = 3;
    int64 rev = 4;
    bytes payload = 5;
  }

  message ServerMsg {
    string type = 1;
    string room_id = 2;
    string game_id = 3;
    int64 rev = 4;
    repeated GameEvent events = 5;
    ErrorMsg error = 6;
    bytes state = 7;
    string from = 8;
    bytes payload = 9;
  }

  message GameEvent {
    string event_id = 1;
    string stream_id = 2;
    int64 seq = 3;
    string type = 4;
    bytes payload = 5;
  }

  message ErrorMsg {
    string code = 1;
    string error = 2;
  }
`).root

const Client = schema.lookupType('angel.ClientMsg')
const Server = schema.lookupType('angel.ServerMsg')
const json = value => Buffer.from(JSON.stringify(value))
const frame = value => Server.encode(Server.create(value)).finish()

test('client command matches server bytes fields', () => {
  const bytes = encodeClient({
    type: 'move',
    roomId: 'room-1',
    rev: 7,
    payload: { token: 2, label: 'منچ' },
  })
  const message = Client.decode(bytes)
  assert.equal(message.type, 'move')
  assert.equal(message.roomId, 'room-1')
  assert.equal(Number(message.rev), 7)
  assert.deepEqual(
    JSON.parse(Buffer.from(message.payload).toString('utf8')),
    { token: 2, label: 'منچ' },
  )
})

test('joined state decodes from bytes', () => {
  const state = { seats: ['a', 'b'], turn: 0 }
  const decoded = decodeServer(frame({
    type: 'joined',
    roomId: 'room-1',
    gameId: 'ludo-light',
    rev: 1,
    state: json(state),
  }))
  assert.deepEqual(decoded.state, state)
  assert.deepEqual(decoded.events, [])
})

test('all events survive a multi-event server frame', () => {
  const decoded = decodeServer(frame({
    type: 'event',
    rev: 8,
    events: [
      {
        eventId: 'room-1:1',
        streamId: 'room-1',
        seq: 1,
        type: 'ludo.rolled',
        payload: json({ dice: 6 }),
      },
      {
        eventId: 'room-1:2',
        streamId: 'room-1',
        seq: 2,
        type: 'ludo.snapshot',
        payload: json({ turn: 1 }),
      },
    ],
  }))
  assert.equal(decoded.events.length, 2)
  assert.equal(decoded.events[1].type, 'ludo.snapshot')
  assert.deepEqual(decoded.events[1].payload, { turn: 1 })
  assert.equal(decoded.event, decoded.events[0])
})

test('server errors remain available', () => {
  const decoded = decodeServer(frame({
    type: 'error',
    error: { code: 'rejected', error: 'Not your turn' },
  }))
  assert.equal(decoded.error.code, 'rejected')
})

test('invalid JSON fails decoding', () => {
  assert.throws(() => decodeServer(frame({
    state: Buffer.from('{broken'),
  })))
})

test('unsafe revisions are rejected', () => {
  assert.throws(() => encodeClient({
    type: 'move',
    rev: Number.MAX_SAFE_INTEGER + 1,
  }))
  assert.throws(() => decodeServer(frame({
    rev: protobuf.util.Long.fromString('9007199254740992'),
  })))
})

test('oversized frames are rejected', () => {
  assert.throws(() => decodeServer(new Uint8Array(1048577)))
})
