import { createServer } from 'node:http'
import {
  readFile,
  realpath,
  stat
} from 'node:fs/promises'
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep
} from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)

let root

try {
  root = await realpath(resolve(project, 'dist'))
  await stat(resolve(root, 'index.html'))
} catch {
  console.error('Build first: npm run build')
  process.exit(1)
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2'
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    res.end()
    return
  }

  try {
    const url = new URL(
      req.url ?? '/',
      'http://localhost'
    )

    let path = decodeURIComponent(url.pathname)

    if (path.endsWith('/')) {
      path += 'index.html'
    }

    const file = await realpath(
      resolve(root, `.${path}`)
    )

    const inside = relative(root, file)

    if (
      inside === '..' ||
      inside.startsWith(`..${sep}`) ||
      isAbsolute(inside)
    ) {
      res.writeHead(403)
      res.end()
      return
    }

    if (!(await stat(file)).isFile()) {
      throw new Error('Not a file')
    }

    const data = await readFile(file)

    res.writeHead(200, {
      'Content-Type':
        mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': data.length
    })

    res.end(
      req.method === 'HEAD' ? undefined : data
    )
  } catch {
    res.writeHead(404)
    res.end()
  }
})

server.on('error', error => {
  console.error(error.message)
  process.exitCode = 1
})

server.listen(4173, '127.0.0.1', () => {
  console.log('Preview: http://127.0.0.1:4173')
  console.log(
    'Local preview only; this is NOT a multiplayer server.'
  )
})
