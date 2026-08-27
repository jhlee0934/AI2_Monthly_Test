import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { BLANK_MARKER_PATTERN, loadProjectProblems } from '../scripts/parser.mjs';

const problems = loadProjectProblems(path.resolve('.'));
test('원본 문제는 flow와 api 유형만 포함한다', () => {
  assert.ok(problems.length > 0);
  assert.ok(problems.every((item) => item.type === 'flow' || item.type === 'api'));
  assert.ok(problems.some((item) => item.type === 'api'));
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
test('문제 파일은 개념형 50개와 중복 통합된 API 문제를 제공한다', () => {
  const sample = JSON.parse(fs.readFileSync(path.resolve('problems/exam_questions.json'), 'utf8')).problems;
  assert.equal(sample.filter((item) => item.type === 'flow').length, 50);
  assert.equal(sample.filter((item) => item.type === 'api').length, 35);
  assert.ok(sample.filter((item) => item.type === 'flow').every((item) => item.keywords.length >= 1 && item.keywords.length <= 2));
  assert.ok(sample.filter((item) => item.type === 'api').every((item) => item.content.includes('전체 과정 중') || item.id === 'api-generated-001'));
  assert.ok(sample.filter((item) => item.type === 'api').every((item) => item.blanks.length >= 1 && item.blanks.length <= 5));
  const solutions = sample.filter((item) => item.type === 'api').map((item) => item.solution.replace(/\s+/g, ' ').trim());
  assert.equal(new Set(solutions).size, solutions.length);
  assert.deepEqual(validateSampleIds(sample), []);
});
test('Python 던더 이름은 API 빈칸으로 인식하지 않는다', () => {
  assert.deepEqual([...`def __init__(self):\n    ____[1]\n    return ①`.matchAll(BLANK_MARKER_PATTERN)].map((match) => match[0]), ['____[1]']);
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  assert.match(client, /const markerPattern = \/_\{2,\}\\\[\(\\d\+\)\\\]/);
  assert.doesNotMatch(client, /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/);
});

test('API 문제 해설은 정답별 개념과 완성 코드 맥락을 제공한다', () => {
  const api = problems.filter((item) => item.type === 'api');
  const samples = api.filter((item) => item.id.startsWith('api-generated-'));
  assert.ok(samples.every((item) => item.explanation.includes('완성하면')));
  assert.ok(samples.every((item) => item.blanks.every((blank) => item.explanation.includes(blank.answer))));
  assert.ok(samples.every((item) => !item.explanation.includes('노트북이 사용한 핵심 호출 또는 옵션')));
  assert.ok(samples.every((item) => !/\[\d+\] 정답은/.test(item.explanation)));
  assert.ok(samples.every((item) => item.blanks.every((_, index) => item.explanation.split(`빈칸 ${index + 1}\n정답:`).length === 2)));
  assert.ok(samples.every((item) => !item.explanation.includes('앞에서 준비된 객체와 입력을 사용해 다음 줄이 요구하는 반환값 또는 상태를 만듭니다.')));
  assert.ok(samples.every((item) => !item.explanation.includes('빈칸 앞에서 준비된 객체·입력과 뒤 연산이 요구하는 타입, shape 또는 실행 순서가 일치해야 합니다.')));
});
test('기존 coding 유형과 CodeMirror 구현을 포함하지 않는다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  assert.doesNotMatch(client, /CodeMirror|buildPythonCompletions|renderCoding|type === 'coding'/);
});
test('Blockly 편집기와 사용자 API 키 입력을 포함하지 않는다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf8');
  assert.doesNotMatch(client, /Blockly|pythonGenerator|\/api\/review/);
  assert.doesNotMatch(html, /blockly|globalApiKey|globalModel|api-settings-dropdown/i);
});
test('문제 목록은 단원별 접기·펼치기 구조를 사용한다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf8');
  assert.match(client, /class="unit-group \$\{isOpen \? 'open' : ''\}"/);
  assert.match(client, /aria-expanded="\$\{isOpen\}"/);
  assert.match(client, /querySelectorAll\('\.problem-link'\)/);
  assert.doesNotMatch(client, /els\.list\.querySelectorAll\('button'\)/);
  assert.doesNotMatch(html, /id="unitFilter"/);
  assert.match(client, /unit\.localeCompare\(b\.unit, 'ko', \{ numeric: true \}\)/);
  assert.doesNotMatch(client, /\$\{index \+ 1\}\. \$\{escapeHtml\(item\.title\)\}/);
});
test('GitHub Pages 정적 배포는 상대 경로 데이터만 사용하고 신고 기능을 포함하지 않는다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf8');
  const server = fs.readFileSync(path.resolve('server.mjs'), 'utf8');
  assert.match(client, /fetch\('\.\/data\/problems\.json'/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.bundle\.js"/);
  assert.doesNotMatch(`${client}\n${html}\n${server}`, /\/api\/reports|reportDialog/);
});

function validateSampleIds(items) {
  const seen = new Set(); const errors = [];
  for (const item of items) { if (seen.has(item.id)) errors.push(item.id); seen.add(item.id); }
  return errors;
}
