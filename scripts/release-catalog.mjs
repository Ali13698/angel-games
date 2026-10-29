import { writeFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanGames } from './catalog.mjs'
import { verifyWasm } from './verify-wasm.mjs'

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)

const output = resolve(root, 'catalog-release.json')

async function main() {
  await rm(output, { force: true })

  const catalog = await scanGames(root, {
    artifacts: true
  })

  if (catalog.games.length === 0) {
    throw new Error('Cannot create an empty release catalog')
  }

  for (const game of catalog.games) {
    for (const name of ['wasm', 'entry']) {
      if (game.artifacts[name].size === 0) {
        throw new Error(`${game.id}: empty ${name} artifact`)
      }
    }

    await verifyWasm(
      resolve(root, game.artifacts.wasm.path)
    )
  }

  await writeFile(
    output,
    JSON.stringify(catalog, null, 2) + '\n'
  )

  console.log(`Verified artifacts for ${catalog.games.length} game(s)`)
  console.log('Created catalog-release.json')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
