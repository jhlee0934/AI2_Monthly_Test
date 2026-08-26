import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export async function buildClient(root) {
  await build({
    absWorkingDir: root,
    entryPoints: ['./public/app.js'],
    outfile: 'public/app.bundle.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    sourcemap: true,
    logLevel: 'warning',
  });
  console.log('CodeMirror 클라이언트 번들을 생성했습니다.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildClient(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
}
