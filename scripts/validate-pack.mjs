import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadActiveProblemPack, loadProblemPack } from './problem-pack.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requested = process.argv[2];
if (requested && !/^[A-Za-z0-9._-]+$/.test(requested)) throw new Error('문제 팩 이름에는 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.');
const pack = requested
  ? loadProblemPack(path.join(root, 'problem-packs', requested), path.join(root, 'problem-packs'))
  : loadActiveProblemPack(root);
console.log(`문제 팩 검증 통과: ${pack.manifest.title} (${pack.problems.length}문제)`);
