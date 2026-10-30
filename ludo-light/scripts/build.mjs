import { build } from 'esbuild';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const online = process.argv.includes('--online');

async function main() {
  const sdkEntry = process.env.ANGEL_SDK_ENTRY
    ? resolve(root, process.env.ANGEL_SDK_ENTRY)
    : resolve(root, '../sdk/src/index.ts');

  if (online) await access(sdkEntry);

  await rm(dist, { recursive: true, force: true });
  await mkdir(resolve(dist, 'src'), { recursive: true });
  await mkdir(resolve(dist, 'assets'), { recursive: true });

  const options = {
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    sourcemap: false,
    logLevel: 'info',
  };

  await build({
    ...options,
    entryPoints: [resolve(root, online ? 'src/online.ts' : 'src/main.ts')],
    outfile: resolve(dist, 'src/main.js'),
    external: ['@angel/sdk'],
  });

  let html = await readFile(resolve(root, 'index.html'), 'utf8');

  if (online) {
    await build({
      ...options,
      entryPoints: [sdkEntry],
      outfile: resolve(dist, 'assets/angel-sdk.js'),
    });

    await build({
      ...options,
      entryPoints: [resolve(root, 'src/lobby.ts')],
      outfile: resolve(dist, 'assets/lobby.js'),
    });

    const map = JSON.stringify({
      imports: { '@angel/sdk': './assets/angel-sdk.js' },
    });

    html = html.replace(
      '</head>',
      `<script type="importmap">${map}</script>\n</head>`,
    );
  }

  await cp(resolve(root, 'styles'), resolve(dist, 'styles'), {
    recursive: true,
  });
  await writeFile(resolve(dist, 'index.html'), html);

  console.log(online ? 'Online game and lobby built.' : 'Offline preview built.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
