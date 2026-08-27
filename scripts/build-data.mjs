import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectProblems } from './parser.mjs';
import { validateProblems } from './problem-pack.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = loadProjectProblems(root);
const errors = validateProblems(problems);
if (errors.length) throw new Error(`변환된 문제 검증 실패:\n- ${errors.join('\n- ')}`);
const output = path.join(root, 'problem-packs', 'monthly-ai', 'problems.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), problems }, null, 2));
fs.rmSync(path.join(root, 'public', 'data', 'problems.json'), { force: true });
console.log(`${problems.length}개 문제를 기본 문제 팩으로 변환했습니다.`);
