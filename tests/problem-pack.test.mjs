import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadProblemPack, validateProblems } from '../scripts/problem-pack.mjs';
import { loadProjectProblems } from '../scripts/parser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('네 문제 유형 템플릿이 공통 검증을 통과한다', () => {
  for (const type of ['assessment', 'flow', 'api', 'assembly']) {
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

test('flow 문제는 중복 없는 선택지 4개와 포함된 정답만 허용한다', () => {
  const base = JSON.parse(fs.readFileSync(path.join(root, 'problem-templates', 'flow.json'), 'utf8'));
  const missing = structuredClone(base);
  missing.choices = ['오답 1', '오답 2', '오답 3', '오답 4'];
  const duplicate = structuredClone(base);
  duplicate.id = 'flow-example-002';
  duplicate.choices[3] = duplicate.choices[2];
  const errors = validateProblems([missing, duplicate]);
  assert.ok(errors.some((error) => error.includes('flow choices에 answer')));
  assert.ok(errors.some((error) => error.includes('중복 없는 문자열 선택지 4개')));
});
