import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)

const output = resolve(root, 'dist/game.wasm')

async function main() {
  await mkdir(dirname(output), { recursive: true })
  await rm(output, { force: true })

  const result = spawnSync(
    'go',
    [
      'build',
      '-trimpath',
      '-buildmode=c-shared',
      '-o', output,
      '.'
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        GOOS: 'wasip1',
        GOARCH: 'wasm',
        CGO_ENABLED: '0'
      }
    }
  )

  if (result.error) throw result.error

  if (result.status !== 0) {
    throw new Error('WASM build failed')
  }

  const bytes = await readFile(output)
  const header = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])

  if (!bytes.subarray(0, 8).equals(header)) {
    throw new Error('Invalid WASM header')
  }

  const module = await WebAssembly.compile(bytes)
  const exports = WebAssembly.Module.exports(module)

  for (const name of ['reset', 'allocate', 'apply']) {
    if (!exports.some(item =>
      item.name === name && item.kind === 'function'
    )) {
      throw new Error(`Missing WASM function: ${name}`)
    }
  }

  if (!exports.some(item =>
    item.name === 'memory' && item.kind === 'memory'
  )) {
    throw new Error('Missing exported memory')
  }

  if (!exports.some(item =>
    item.name === '_initialize' && item.kind === 'function'
  )) {
    throw new Error('Missing WASI reactor initialization')
  }

  console.log(`WASM built and exports checked: ${bytes.length} bytes`)
}

main().catch(async error => {
  await rm(output, { force: true })
  console.error(error)
  process.exitCode = 1
})
