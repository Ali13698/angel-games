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

async function copyTree(source,
