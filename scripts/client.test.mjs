import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import protobuf from 'protobufjs'

if (!process.env.CLIENT_BUNDLE) {
  throw new Error('CLIENT_BUNDLE is required')
}

const { AngelClient } = await import(
  pathToFileURL(process.env.CLIENT_BUNDLE).href
)

const root = await protobuf.load('protocol/angel.proto')
const Server = root.lookupType('angel.ServerMsg')
const Client = root.lookupType('angel.ClientMsg')

class Socket {
  static OPEN = 1
  static latest
  readyState = 0
  sent = []

  constructor() {
    Socket.latest = this
  }

  open() {
    this.readyState = 1
    this.onopen?.()
  }

  send(bytes) {
    if (this.readyState !== 1) throw new Error('closed')
    this.sent.push(Client.decode(bytes))
  }

  close() {
    this.readyState = 3
    this.onclose?.()
  }

  frame(value) {
    const bytes = Server.encode(Server.create(value)).finish()
    this.onmessage?.({ data: Uint8Array.from(bytes).buffer })
  }
}

function fixture(t, timeout = 1000) {
  const previous = globalThis.WebSocket
  globalThis.WebSocket = Socket

  const client = new AngelClient(
    'wss://example.invalid/ws',
    'r1',
    'u1',
    timeout,
  )

  t.after(() => {
    client.close()
    globalThis.WebSocket = previous
  })

  const pending = client.connect()
  return { client, pending, socket: Socket.latest }
}

const joined = { type: 'joined', roomId: 'r1', rev: 7 }

test('open sends binary join but does not resolve connect', async t => {
  const f = fixture(t)
  let ready = false

  f.pending.then(() => { ready = true })
  f.socket.open()
  await Promise.resolve()

  assert.equal(ready, false)
  assert.equal(f.socket.sent[0].type, 'join')
  assert.equal(f.socket.sent[0].id, 'u1')
  assert.equal(f.socket.sent[0].roomId, 'r1')

  f.socket.frame(joined)
  await f.pending
  assert.equal(ready, true)
})

test('commands are blocked before join; sync works inside joined listener', async t => {
  const f = fixture(t)
  f.socket.open()

  assert.throws(() => f.client.command('roll'), /membership/)

  f.client.on('joined', () => f.client.command('sync'))
  f.socket.frame(joined)
  await f.pending

  assert.equal(f.socket.sent[1].type, 'sync')
  assert.equal(Number(f.socket.sent[1].rev), 7)
})

test('wrong room and unconfirmed state cannot complete join', async t => {
  const f = fixture(t)
  f.socket.open()

  f.socket.frame({ ...joined, roomId: 'other', rev: 99 })
  f.socket.frame({ type: 'state', roomId: 'r1', rev: 98 })

  assert.equal(f.client.rev, 0)
  assert.throws(() => f.client.command('roll'))

  f.socket.frame(joined)
  await f.pending
  assert.equal(f.client.rev, 7)
})

test('join rejection rejects connect and emits original error once', async t => {
  const f = fixture(t)
  const errors = []

  f.client.on('error', frame => errors.push(frame.error.code))
  f.socket.open()
  f.socket.frame({
    type: 'error',
    error: { code: 'no_room', error: 'No room' },
  })

  await assert.rejects(f.pending, /No room/)
  assert.deepEqual(errors, ['no_room'])
  assert.equal(f.socket.readyState, 3)
})

test('join timeout closes socket', async t => {
  const f = fixture(t, 20)
  f.socket.open()

  await assert.rejects(f.pending, /timed out/)
  assert.equal(f.socket.readyState, 3)
})

test('explicit close rejects pending join', async t => {
  const f = fixture(t)
  f.client.close()

  await assert.rejects(f.pending, /cancelled/)
})

test('text frames are rejected', async t => {
  const f = fixture(t)
  f.socket.open()
  f.socket.onmessage({ data: '{}' })

  await assert.rejects(f.pending, /binary Protobuf/)
})

test('old socket callbacks cannot affect a replacement connection', async t => {
  const f = fixture(t)
  const next = f.client.connect()

  await assert.rejects(f.pending, /cancelled/)
  f.socket.frame({ ...joined, rev: 99 })

  const current = Socket.latest
  current.open()
  current.frame(joined)

  await next
  assert.equal(f.client.rev, 7)
})

test('command errors preserve membership; disconnect removes it', async t => {
  const f = fixture(t)
  f.socket.open()
  f.socket.frame(joined)
  await f.pending

  const events = []
  f.client.on('ludo.rolled', frame => events.push(frame.event.type))

  f.socket.frame({
    type: 'event',
    roomId: 'r1',
    rev: 8,
    events: [
      { type: 'ludo.rolled' },
      { type: 'ludo.rolled' },
    ],
  })

  assert.equal(events.length, 2)

  f.socket.frame({
    type: 'error',
    error: { code: 'rejected', error: 'Not your turn' },
  })

  f.client.command('sync')
  assert.equal(Number(f.socket.sent.at(-1).rev), 8)

  f.socket.close()
  assert.throws(() => f.client.command('roll'), /membership/)
})
