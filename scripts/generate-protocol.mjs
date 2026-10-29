import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)

function run(tool, args) {
  const script = require.resolve(
    `protobufjs-cli/bin/${tool}`
  )

  const result = spawnSync(
    process.execPath,
    [script, ...args],
    {
      cwd: root,
      stdio: 'inherit'
    }
  )

  if (result.error) throw result.error

  if (result.status !== 0) {
    throw new Error(`${tool} failed`)
  }
}

run('pbjs', [
  '-t', 'static-module',
  '-w', 'es6',
  '-o', 'protocol/angel_pb.js',
  'protocol/angel.proto'
])

run('pbts', [
  '-o', 'protocol/angel_pb.d.ts',
  'protocol/angel_pb.js'
])

console.log(
  'Generated protocol bindings from angel.proto'
)
