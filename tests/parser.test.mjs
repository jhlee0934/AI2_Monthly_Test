import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { parseProblems } from '../scripts/parser.mjs';

const problems = parseProblems(path.resolve('problems'));
test('세 문제 유형이 모두 변환된다', () => {
  assert.ok(problems.length > 30);
  assert.deepEqual(new Set(problems.map((item) => item.type)), new Set(['flow', 'api', 'coding']));
});
test('ID가 중복되지 않는다', () => assert.equal(new Set(problems.map((item) => item.id)).size, problems.length));
test('난이도 분류를 생성하지 않는다', () => assert.ok(problems.every((item) => !('difficulty' in item))));
test('원본 Markdown 구조 문법이 표시 필드에 남지 않는다', () => {
  const leaked = /(^|\n)#{1,6}\s|<a id=|\[(?:문제로 돌아가기|정답으로 이동)\]|(^|\n)---\s*($|\n)/m;
  assert.ok(problems.every((item) => !leaked.test(`${item.content}\n${item.explanation}`)));
});
test('API 문제에는 채점 가능한 빈칸이 있다', () => {
  const api = problems.filter((item) => item.type === 'api');
  assert.ok(api.length > 0);
  assert.ok(api.every((item) => item.blanks.length > 0));
  assert.ok(api.every((item) => item.blanks.every((blank) => blank.answer && blank.choices.includes(blank.answer))));
});
test('실전 코딩 문제는 요구사항과 스켈레톤을 보존한다', () => assert.ok(problems.filter((item) => item.type === 'coding').every((item) => item.requirements.length && item.skeleton)));
test('자동완성 후보가 모범 답안을 직접 사용하지 않는다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  assert.doesNotMatch(client, /buildPythonCompletions[\s\S]*?problem\.solution[\s\S]*?return \[\.\.\.suggestions\.values\(\)\]/);
});
test('공통 API 설정과 Tab 자동완성 적용이 유지된다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf8');
  assert.match(client, /key: 'Tab', run: acceptCompletion/);
  assert.match(html, /id="globalApiKey"/);
  assert.match(html, /id="globalModel"[^>]*value="gpt-5\.4-mini"/);
  assert.match(html, /<details class="api-settings-dropdown">/);
  assert.doesNotMatch(client, /id="apiKey"|id="reviewModel"/);
});
test('문제 목록은 단원별 접기·펼치기 구조를 사용한다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf8');
  assert.match(client, /class="unit-group \$\{isOpen \? 'open' : ''\}"/);
  assert.match(client, /aria-expanded="\$\{isOpen\}"/);
  assert.match(client, /querySelectorAll\('\.problem-link'\)/);
  assert.doesNotMatch(client, /els\.list\.querySelectorAll\('button'\)/);
  assert.doesNotMatch(html, /id="unitFilter"/);
});
