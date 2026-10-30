import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  access,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { packageHost } from './package-host.mjs'

function descriptor(path, bytes) {
  return {
    path,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'angel-package-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  const dist = resolve(root, 'sample/dist')
  await mkdir(resolve(dist, 'assets'), { recursive: true })

  const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])
  const html = Buffer.from('<script src="./assets/app.js"></script>')

  await writeFile(resolve(dist, 'game.wasm'), wasm)
  await writeFile(resolve(dist, 'index.html'), html)
  await writeFile(resolve(dist, 'assets/app.js'), 'console.log("ok")')

  const catalog = {
    schemaVersion: 1,
    verifiedArtifacts: true,
    games: [{
      id: 'sample',
      version: '1.0.0',
      abi: 'angel-apply-v1',
      directory: 'sample',
      artifacts: {
        wasm: descriptor('sample/dist/game.wasm', wasm),
        entry: descriptor('sample/dist/index.html', html),
      },
    }],
  }

  const save = () => writeFile(
    resolve(root, 'catalog-release.json'),
    JSON.stringify(catalog),
  )

  await save()

  return {
    root,
    dist,
    catalog,
    save,
    output: resolve(root, 'host-package'),
  }
}

test('packages WASM and nested web assets separately', async t => {
  const f = await fixture(t)
  const result = await packageHost(f.root, f.output)

  assert.equal(result.games.length, 1)
  assert.equal(result.games[0].wasm, 'games/sample/game.wasm')

  assert.equal(
    await readFile(
      resolve(f.output, 'web/games/sample/assets/app.js'),
      'utf8',
    ),
    'console.log("ok")',
  )

  await access(resolve(f.output, 'games/sample/game.wasm'))

  await assert.rejects(
    access(resolve(f.output, 'web/games/sample/game.wasm')),
  )

  const saved = JSON.parse(
    await readFile(resolve(f.output, 'host-manifest.json'), 'utf8'),
  )
  assert.deepEqual(saved, result)
})

test('rejects modified artifacts', async t => {
  const f = await fixture(t)
  await writeFile(resolve(f.dist, 'index.html'), 'changed')

  await assert.rejects(
    packageHost(f.root, f.output),
    /integrity mismatch/,
  )
})

test('rejects duplicate game IDs', async t => {
  const f = await fixture(t)
  f.catalog.games.push(structuredClone(f.catalog.games[0]))
  await f.save()

  await assert.rejects(
    packageHost(f.root, f.output),
    /duplicate game/,
  )
})

test('rejects paths outside the game directory', async t => {
  const f = await fixture(t)
  f.catalog.games[0].artifacts.wasm.path = '../outside.wasm'
  await f.save()

  await assert.rejects(
    packageHost(f.root, f.output),
    /escapes/,
  )
})

test('rejects symlinked web assets', async t => {
  const f = await fixture(t)
  await writeFile(resolve(f.root, 'private.txt'), 'not a web asset')
  await symlink(
    resolve(f.root, 'private.txt'),
    resolve(f.dist, 'leak.txt'),
  )

  await assert.rejects(
    packageHost(f.root, f.output),
    /Symlinks are not allowed/,
  )
})

test('does not overwrite an existing package', async t => {
  const f = await fixture(t)
  await packageHost(f.root, f.output)

  await assert.rejects(
    packageHost(f.root, f.output),
    { code: 'EEXIST' },
  )
})

test('rejects unverified catalogs', async t => {
  const f = await fixture(t)
  f.catalog.verifiedArtifacts = false
  await f.save()

  await assert.rejects(
    packageHost(f.root, f.output),
    /verified release catalog/,
  )
})
