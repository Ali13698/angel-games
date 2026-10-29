import { readFile } from 'node:fs/promises'

export async function verifyWasm(path) {
  const bytes = await readFile(path)
  const header = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])

  if (!bytes.subarray(0, 8).equals(header)) {
    throw new Error(`Invalid WASM header: ${path}`)
  }

  const module = await WebAssembly.compile(bytes)
  const exports = WebAssembly.Module.exports(module)

  const required = [
    ['memory', 'memory'],
    ['_initialize', 'function'],
    ['reset', 'function'],
    ['allocate', 'function'],
    ['apply', 'function']
  ]

  for (const [name, kind] of required) {
    if (!exports.some(item =>
      item.name === name && item.kind === kind
    )) {
      throw new Error(`Missing ${kind} export "${name}": ${path}`)
    }
  }

  if (exports.some(item => item.name === '_start')) {
    throw new Error(`Expected a reactor, not a command: ${path}`)
  }

  return {
    size: bytes.length,
    exports: exports.map(item => item.name)
  }
}
