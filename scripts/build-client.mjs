import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export async function buildClient(root) {
  fs.rmSync(path.join(root, 'public', 'app.bundle.js.map'), { force: true });
  await build({
    stdin: {
      contents: fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8'),
      sourcefile: 'app.js',
      resolveDir: path.join(root, 'public'),
    },
    outfile: path.join(root, 'public', 'app.bundle.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    sourcemap: false,
    logLevel: 'warning',
  });
  console.log('클라이언트 번들을 생성했습니다.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildClient(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
}
