import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadProblemPack, validateProblems } from '../scripts/problem-pack.mjs';
import { loadProjectProblems } from '../scripts/parser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('세 문제 유형 템플릿이 공통 검증을 통과한다', () => {
  for (const type of ['flow', 'api', 'assembly']) {
    const problem = JSON.parse(fs.readFileSync(path.join(root, 'problem-templates', `${type}.json`), 'utf8'));
    assert.deepEqual(validateProblems([problem]), []);
  }
});

test('기본 문제 팩을 독립 데이터로 불러온다', () => {
  const pack = loadProblemPack(path.join(root, 'problem-packs', 'monthly-ai'), path.join(root, 'problem-packs'));
  const source = loadProjectProblems(root);
  assert.equal(pack.manifest.id, 'monthly-ai');
  assert.equal(pack.problems.length, source.length);
});

test('중복 ID와 빈칸 정답 선택지 누락을 거부한다', () => {
  const base = JSON.parse(fs.readFileSync(path.join(root, 'problem-templates', 'api.json'), 'utf8'));
  const duplicate = structuredClone(base);
  duplicate.blanks[0].choices = ['wrong'];
  const errors = validateProblems([base, duplicate]);
  assert.ok(errors.some((error) => error.includes('중복')));
  assert.ok(errors.some((error) => error.includes('choices에 answer')));
});
