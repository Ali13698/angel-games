import { readFile } from 'node:fs/promises'
import { WASI } from 'node:wasi'

export async function openGame(path) {
  const wasi = new WASI({
    version: 'preview1',
    args: [],
    env: {},
    preopens: {},
    returnOnExit: true
  })

  const bytes = await readFile(path)
  const module = await WebAssembly.compile(bytes)

  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport
  })

  wasi.initialize(instance)

  const api = instance.exports
  const encoder = new TextEncoder()
  const decoder = new TextDecoder('utf-8', { fatal: true })

  function checkRange(pointer, length) {
    const size = api.memory.buffer.byteLength

    if (
      !Number.isInteger(pointer) ||
      !Number.isInteger(length) ||
      pointer < 0 ||
      length < 0 ||
      pointer > size ||
      length > size - pointer
    ) {
      throw new Error('WASM memory range is invalid')
    }
  }

  function put(value) {
    const bytes = encoder.encode(JSON.stringify(value))
    const pointer = api.allocate(bytes.length) >>> 0

    if (!pointer) {
      throw new Error('WASM allocation failed')
    }

    checkRange(pointer, bytes.length)

    new Uint8Array(
      api.memory.buffer,
      pointer,
      bytes.length
    ).set(bytes)

    return [pointer, bytes.length]
  }

  function apply(state, intent, context = {}) {
    api.reset()

    const s = put(state)
    const i = put(intent)
    const c = put(context)

    const pointer = api.apply(...s, ...i, ...c) >>> 0

    if (!pointer) return null

    checkRange(pointer, 4)

    const length = new DataView(
      api.memory.buffer
    ).getUint32(pointer, true)

    checkRange(pointer + 4, length)

    const text = decoder.decode(
      new Uint8Array(
        api.memory.buffer,
        pointer + 4,
        length
      )
    )

    const result = JSON.parse(text)

    if (
      !result ||
      typeof result.state !== 'object' ||
      result.state === null ||
      !Array.isArray(result.events)
    ) {
      throw new Error('Invalid apply result')
    }

    return result
  }

  return { apply }
}
