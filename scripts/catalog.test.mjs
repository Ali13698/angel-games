import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanGames } from './catalog.mjs'

async function fixture(t) {
  const root = await mkdtemp(
    join(tmpdir(), 'angel-catalog-')
  )

  t.after(() => rm(root, {
    recursive: true,
    force: true
  }))

  const manifest = {
    schemaVersion: 1,
    id: 'sample',
    version: '1.0.0',
    abi: 'angel-apply-v1',
    runtime: 'wasi-reactor',
    source: '.',
    artifacts: {
      wasm: 'dist/game.wasm',
      entry: 'dist/index.html'
    }
  }

  await mkdir(join(root, 'sample/dist'), {
    recursive: true
  })

  const save = () => writeFile(
    join(root, 'sample/game.json'),
    JSON.stringify(manifest)
  )

  await save()

  return { root, manifest, save }
}

test(
  'discovers without game-specific names, rejects missing builds',
  async t => {
    const { root } = await fixture(t)

    assert.equal(
      (await scanGames(root)).games[0].id,
      'sample'
    )

    await assert.rejects(
      scanGames(root, { artifacts: true })
    )
  }
)

test('rejects path traversal', async t => {
  const { root, manifest, save } = await fixture(t)

  manifest.artifacts.wasm = '../outside.wasm'
  await save()

  await assert.rejects(
    scanGames(root),
    /escapes/
  )
})

test(
  'hashes artifacts and rejects symlink escape',
  async t => {
    const { root } = await fixture(t)

    await writeFile(
      join(root, 'sample/dist/game.wasm'),
      Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])
    )

    await writeFile(
      join(root, 'sample/dist/index.html'),
      '<html></html>'
    )

    const result = await scanGames(root, {
      artifacts: true
    })

    assert.equal(
      result.games[0].artifacts.wasm.sha256.length,
      64
    )

    await rm(join(root, 'sample/dist/index.html'))

    await writeFile(
      join(root, 'outside.html'),
      'outside'
    )

    await symlink(
      join(root, 'outside.html'),
      join(root, 'sample/dist/index.html')
    )

    await assert.rejects(
      scanGames(root, { artifacts: true }),
      /escapes/
    )
  }
)

test('rejects duplicate identifiers', async t => {
  const { root, manifest } = await fixture(t)

  await mkdir(join(root, 'other'))

  await writeFile(
    join(root, 'other/game.json'),
    JSON.stringify(manifest)
  )

  await assert.rejects(
    scanGames(root),
    /Duplicate/
  )
})
