import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  lstat,
  realpath,
} from 'node:fs/promises'
import {
  resolve,
  relative,
  isAbsolute,
  dirname,
  basename,
  join,
} from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

function inside(base, target) {
  const rel = relative(base, target)

  if (
    rel === '..' ||
    rel.startsWith('../') ||
    rel.startsWith('..\\') ||
    isAbsolute(rel)
  ) {
    throw new Error('Path escapes its permitted directory')
  }
}

async function sourceFile(root, gameRoot, name) {
  if (
    typeof name !== 'string' ||
    !name ||
    name.includes('\\') ||
    isAbsolute(name)
  ) {
    throw new Error('Invalid artifact path')
  }

  const target = resolve(root, name)
  inside(gameRoot, target)

  const actual = await realpath(target)
  inside(gameRoot, actual)

  const stat = await lstat(target)

  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('Artifact must be a regular file')
  }

  return target
}

async function verifiedBytes(path, descriptor) {
  const bytes = await readFile(path)
  const hash = createHash('sha256').update(bytes).digest('hex')

  if (
    !bytes.length ||
    descriptor.size !== bytes.length ||
    descriptor.sha256 !== hash
  ) {
    throw new Error(`Artifact integrity mismatch: ${path}`)
  }

  return bytes
}

async function copyTree(source, destination) {
  await mkdir(destination, { recursive: true })

  const entries = await readdir(source, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const from = join(source, entry.name)
    const to = join(destination, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed: ${from}`)
    }

    if (entry.isDirectory()) {
      await copyTree(from, to)
    } else if (entry.isFile()) {
      // Server WASM modules are packaged separately.
      if (entry.name.toLowerCase().endsWith('.wasm')) continue

      await writeFile(to, await readFile(from), { flag: 'wx' })
    } else {
      throw new Error(`Unsupported file type: ${from}`)
    }
  }
}

export async function packageHost(root, output) {
  root = await realpath(root)
  output = resolve(output)

  const release = JSON.parse(
    await readFile(resolve(root, 'catalog-release.json'), 'utf8'),
  )

  if (
    release.schemaVersion !== 1 ||
    release.verifiedArtifacts !== true ||
    !Array.isArray(release.games) ||
    release.games.length === 0
  ) {
    throw new Error('A non-empty verified release catalog is required')
  }

  const ids = new Set()
  const prepared = []

  for (const game of release.games) {
    if (
      typeof game.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id) ||
      ids.has(game.id) ||
      game.abi !== 'angel-apply-v1' ||
      typeof game.directory !== 'string' ||
      !/^[a-zA-Z0-9_-]+$/.test(game.directory)
    ) {
      throw new Error('Invalid or duplicate game')
    }

    ids.add(game.id)

    const gameRoot = await realpath(resolve(root, game.directory))
    inside(root, gameRoot)

    const wasmPath = await sourceFile(
      root,
      gameRoot,
      game.artifacts?.wasm?.path,
    )

    const entryPath = await sourceFile(
      root,
      gameRoot,
      game.artifacts?.entry?.path,
    )

    // Require a self-contained dist directory.
    const webRoot = dirname(entryPath)

    if (
      basename(entryPath) !== 'index.html' ||
      webRoot !== resolve(gameRoot, 'dist')
    ) {
      throw new Error(`${game.id}: expected dist/index.html`)
    }

    const outputRelative = relative(webRoot, output)

    if (
      outputRelative === '' ||
      (!outputRelative.startsWith('..') && !isAbsolute(outputRelative))
    ) {
      throw new Error('Output cannot be inside source assets')
    }

    const wasm = await verifiedBytes(wasmPath, game.artifacts.wasm)
    await verifiedBytes(entryPath, game.artifacts.entry)

    if (
      !wasm.subarray(0, 8).equals(
        Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
      )
    ) {
      throw new Error(`${game.id}: invalid WASM header`)
    }

    prepared.push({ game, wasm, webRoot })
  }

  // Never overwrite an existing package.
  await mkdir(dirname(output), { recursive: true })
  await mkdir(output)

  const manifest = {
    schemaVersion: 1,
    games: [],
  }

  for (const { game, wasm, webRoot } of prepared) {
    const wasmName = `games/${game.id}/game.wasm`
    const entryName = `web/games/${game.id}/index.html`

    await mkdir(dirname(resolve(output, wasmName)), {
      recursive: true,
    })

    await writeFile(resolve(output, wasmName), wasm, {
      flag: 'wx',
    })

    await copyTree(
      webRoot,
      resolve(output, 'web', 'games', game.id),
    )

    manifest.games.push({
      id: game.id,
      version: game.version,
      abi: game.abi,
      wasm: wasmName,
      wasmSha256: game.artifacts.wasm.sha256,
      entry: entryName,
    })
  }

  await writeFile(
    resolve(output, 'host-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  )

  return manifest
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
  )

  const output = resolve(
    process.argv[2] ?? resolve(root, 'host-package'),
  )

  packageHost(root, output).then(manifest => {
    console.log(`Packaged ${manifest.games.length} game(s): ${output}`)
  }).catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
