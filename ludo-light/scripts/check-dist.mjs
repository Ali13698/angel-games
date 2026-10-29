import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../dist'
)

async function checkFile(path) {
  const info = await stat(resolve(dist, path))

  if (!info.isFile() || info.size === 0) {
    throw new Error(`Missing or empty output: ${path}`)
  }
}

async function main() {
  for (const path of [
    'index.html',
    'src/main.js',
    'assets/angel-sdk.js',
    'game.wasm'
  ]) {
    await checkFile(path)
  }

  const html = await readFile(
    resolve(dist, 'index.html'),
    'utf8'
  )

  const match = html.match(
    /<script\b[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i
  )

  if (!match) {
    throw new Error('Online SDK import map is missing')
  }

  const map = JSON.parse(match[1])

  if (map.imports?.['@angel/sdk'] !== './assets/angel-sdk.js') {
    throw new Error('Unexpected SDK import path')
  }

  const styles = await readdir(resolve(dist, 'styles'))
  const css = styles.filter(name => name.endsWith('.css'))

  if (css.length === 0) {
    throw new Error('No CSS output found')
  }

  for (const name of css) {
    await checkFile(`styles/${name}`)
  }

  console.log('Distribution files checked')
  console.log('Online multiplayer still requires a server test')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
