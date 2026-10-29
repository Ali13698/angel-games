import { readdir, readFile, realpath } from 'node:fs/promises'
import {
  resolve,
  relative,
  isAbsolute,
  dirname
} from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

function inside(root, target) {
  const rel = relative(root, target)

  if (
    rel === '..' ||
    rel.startsWith('../') ||
    isAbsolute(rel)
  ) {
    throw new Error('Path escapes game directory')
  }
}

export async function scanGames(
  root,
  { artifacts = false } = {}
) {
  root = await realpath(root)

  const games = []
  const ids = new Set()

  const directories = (
    await readdir(root, { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name))

  for (const dir of directories) {
    if (
      !dir.isDirectory() ||
      dir.name.startsWith('.')
    ) {
      continue
    }

    const base = resolve(root, dir.name)
    let text

    try {
      text = await readFile(
        resolve(base, 'game.json'),
        'utf8'
      )
    } catch (err) {
      if (err.code === 'ENOENT') continue
      throw err
    }

    const m = JSON.parse(text)

    if (
      m.schemaVersion !== 1 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.id ?? '') ||
      !/^\d+\.\d+\.\d+$/.test(m.version ?? '') ||
      m.abi !== 'angel-apply-v1' ||
      m.runtime !== 'wasi-reactor' ||
      m.source !== '.'
    ) {
      throw new Error(`Invalid manifest: ${dir.name}`)
    }

    if (ids.has(m.id)) {
      throw new Error(`Duplicate game ID: ${m.id}`)
    }

    ids.add(m.id)

    const files = {}

    for (const key of ['wasm', 'entry']) {
      const name = m.artifacts?.[key]

      if (
        typeof name !== 'string' ||
        !name ||
        isAbsolute(name) ||
        name.includes('\\')
      ) {
        throw new Error(`Invalid ${key} path`)
      }

      const target = resolve(base, name)
      inside(base, target)

      files[key] = {
        path: `${dir.name}/${name}`
      }

      if (artifacts) {
        inside(base, await realpath(target))

        const bytes = await readFile(target)

        if (
          key === 'wasm' &&
          !bytes.subarray(0, 8).equals(
            Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])
          )
        ) {
          throw new Error('Invalid WASM header')
        }

        files[key].sha256 = createHash('sha256')
          .update(bytes)
          .digest('hex')

        files[key].size = bytes.length
      }
    }

    games.push({
      id: m.id,
      version: m.version,
      abi: m.abi,
      directory: dir.name,
      artifacts: files
    })
  }

  return {
    schemaVersion: 1,
    verifiedArtifacts: artifacts,
    games
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..'
  )

  try {
    const catalog = await scanGames(root, {
      artifacts: process.argv.includes('--artifacts')
    })

    console.log(JSON.stringify(catalog, null, 2))
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  }
}
