import { spawnSync } from 'node:child_process'
import { readFile, realpath } from 'node:fs/promises'
import {
  dirname,
  resolve,
  relative,
  isAbsolute
} from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanGames } from './catalog.mjs'
import { verifyWasm } from './verify-wasm.mjs'

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)

function run(args, cwd) {
  const result = spawnSync('npm', args, {
    cwd,
    stdio: 'inherit',
    shell: false
  })

  if (result.error) throw result.error

  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed in ${cwd}`)
  }
}

function assertInside(base, target) {
  const path = relative(base, target)

  if (
    path === '..' ||
    path.startsWith('../') ||
    path.startsWith('..\\') ||
    isAbsolute(path)
  ) {
    throw new Error('Artifact escapes its game directory')
  }
}

async function main() {
  const catalog = await scanGames(root)

  if (catalog.games.length === 0) {
    throw new Error('No game manifests found')
  }

  for (const game of catalog.games) {
    const directory = await realpath(
      resolve(root, game.directory)
    )

    const pkg = JSON.parse(await readFile(
      resolve(directory, 'package.json'),
      'utf8'
    ))

    for (const name of ['test:go', 'build:release']) {
      if (
        typeof pkg.scripts?.[name] !== 'string' ||
        !pkg.scripts[name].trim()
      ) {
        throw new Error(`${game.id}: missing script "${name}"`)
      }
    }

    console.log(`\nBuilding ${game.id}@${game.version}`)

    run(['install', '--ignore-scripts'], directory)
    run(['run', 'test:go'], directory)
    run(['run', 'build:release'], directory)

    const wasm = await realpath(
      resolve(root, game.artifacts.wasm.path)
    )

    assertInside(directory, wasm)
    await verifyWasm(wasm)

    console.log(`Build checked: ${game.id}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
