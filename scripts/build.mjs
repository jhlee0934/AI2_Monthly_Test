import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildClient } from './build-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [path.join(root, 'scripts', 'build-data.mjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(root, 'scripts', 'validate-pack.mjs')], { stdio: 'inherit' });
await buildClient(root);
const source = path.join(root, 'public');
const target = path.join(root, 'dist');
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log('프로덕션 파일을 dist에 생성했습니다.');
