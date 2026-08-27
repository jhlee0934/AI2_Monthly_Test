import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { BLANK_MARKER_PATTERN, loadProjectProblems } from '../scripts/parser.mjs';

const problems = loadProjectProblems(path.resolve('.'));
test('원본 문제는 지원하는 세 문제 유형만 포함한다', () => {
  assert.ok(problems.length > 0);
  assert.ok(problems.every((item) => ['flow', 'api', 'assembly'].includes(item.type)));
  assert.ok(['flow', 'api', 'assembly'].every((type) => problems.some((item) => item.type === type)));
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
test('문제 파일은 개념형과 중복 통합된 API 문제의 출제 규칙을 따른다', () => {
  const sample = problems;
  assert.ok(sample.filter((item) => item.type === 'flow').every((item) => item.keywords.length >= 1 && item.keywords.length <= 2));
  assert.ok(sample.filter((item) => item.type === 'api').every((item) => item.content.includes('전체 과정 중') || item.id === 'api-generated-001'));
  assert.ok(sample.filter((item) => item.type === 'api').every((item) => item.blanks.length >= 1 && item.blanks.length <= 5));
  const solutions = sample.filter((item) => item.type === 'api').map((item) => item.solution.replace(/\s+/g, ' ').trim());
  assert.equal(new Set(solutions).size, solutions.length);
  assert.deepEqual(validateSampleIds(sample), []);
});
test('문제 원본은 유형별·단원별 파일로 분리되어 있다', () => {
  for (const type of ['flow', 'api', 'assembly']) {
    const directory = path.resolve('problems', type);
    const files = fs.readdirSync(directory).filter((file) => file.endsWith('.json')).sort();
    assert.ok(files.length > 0);
    for (const file of files) {
      const items = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')).problems;
      assert.ok(items.length > 0);
      assert.ok(items.every((item) => item.type === type));
      assert.ok(items.every((item) => item.unit === path.basename(file, '.json')));
    }
  }
  assert.equal(fs.existsSync(path.resolve('problems/exam_questions.json')), false);
});
test('1-1과 5-2 신규 문제는 유형별 출제 수와 빈칸 계약을 만족한다', () => {
  for (const unit of ['1-1', '5-2']) {
    assert.equal(problems.filter((item) => item.unit === unit && item.type === 'flow').length, 6);
    const api = problems.filter((item) => item.unit === unit && item.type === 'api');
    assert.equal(api.length, 5);
    assert.ok(api.every((item) => [...item.skeleton.matchAll(BLANK_MARKER_PATTERN)].length === item.blanks.length));
    assert.ok(api.every((item) => !item.blanks.reduce((code, blank, index) => code.replace(`____[${index + 1}]`, blank.answer), item.skeleton).includes('____[')));
  }
});
test('TODO 코드 조립 문제는 클릭 가능한 토큰과 슬롯 계약을 만족한다', () => {
  const assembly = problems.filter((item) => item.type === 'assembly');
  assert.equal(assembly.length, 46);
  assert.ok(assembly.every((item) => item.source.includes('/문제/') && item.source.endsWith('.ipynb')));
  assert.ok(assembly.every((item) => item.slots.length >= 1));
  assert.ok(assembly.every((item) => [...item.skeleton.matchAll(BLANK_MARKER_PATTERN)].length === item.slots.length));
  assert.ok(assembly.every((item) => item.slots.every((slot) => item.tokens.includes(slot.answer))));
  assert.ok(assembly.every((item) => !item.slots.reduce((code, slot, index) => code.replace(`____[${index + 1}]`, slot.answer), item.skeleton).includes('____[')));
  assert.ok(assembly.every((item) => !/\bprint\s*\(/.test(item.skeleton) && !/\bprint\s*\(/.test(item.solution)));
  assert.ok(assembly.every((item) => !item.tokens.includes('print') && !item.slots.some((slot) => slot.answer === 'print')));
  assert.equal(new Set(assembly.map((item) => item.title)).size, assembly.length);
  assert.ok(assembly.every((item) => item.title.length <= 40 && !/TODO|rando$/.test(item.title)));
  const scaling = assembly.find((item) => item.title === 'StandardScaler 전처리');
  const logistic = assembly.find((item) => item.title === '로지스틱 회귀 학습과 평가');
  assert.ok(scaling.solution.includes('StandardScaler') && !scaling.solution.includes('LogisticRegression'));
  assert.ok(logistic.solution.includes('from sklearn.linear_model import LogisticRegression'));
  const exploration = assembly.find((item) => item.solution.includes('wine_dataset = load_wine()'));
  assert.match(exploration.skeleton, /wine_dataset = ____\[\d+\]\(\)/);
  assert.ok(exploration.slots.some((slot) => slot.answer === 'load_wine'));
  const prompted = assembly.filter((item) => item.protectedRanges.length > 0 && item.solution.includes('prompt'));
  assert.ok(prompted.length > 0);
  assert.ok(prompted.every((item) => item.skeleton.includes('prompt = ') && !item.slots.some((slot) => /다음 문장|리뷰를 작성|자료를 기반/.test(slot.answer))));
});
test('세 번째 탭은 클릭 방식의 TODO 코드 조립 UI를 사용한다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf8');
  assert.match(html, /data-type="assembly"[^>]*>TODO 코드 조립/);
  assert.match(client, /function renderAssembly\(/);
  assert.match(client, /function placeAssemblyToken\(/);
  assert.match(client, /class="code-token"/);
  assert.doesNotMatch(client, /dragstart|drop|draggable=/);
  assert.match(client, /assemblyDifficulty: 'normal'/);
  assert.match(client, /function buildHardAssembly\(/);
  assert.match(client, /problem\.protectedRanges\?\.some/);
  assert.match(client, /키워드.*변수·클래스.*메서드·속성.*값·문자열/);
  assert.doesNotMatch(client, /problem\.skeleton && problem\.type !== 'api'/);
  assert.match(html, /class="toolbar"[\s\S]*id="assemblyDifficultyControl"/);
  assert.match(client, /function revealAssemblySlot\(/);
  assert.match(client, /!revealed\.includes\(slot\.id\)/);
  assert.match(client, /id="revealAssemblySlot"[\s\S]*class="token-bank"/);
  assert.match(client, /function ensureAssemblySlotVisible\(/);
  assert.match(client, /function moveAssemblySlot\(/);
  assert.match(client, /현재 슬롯 \$\{activeIndex \+ 1\}/);
  assert.match(client, /function resetAssembly\(/);
  assert.match(client, /function nextEmptyAssemblySlot\(/);
  assert.match(client, /정답 코드는 모두 맞힌 뒤/);
  assert.match(client, /const resultClass = result === true/);
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
test('모바일에서는 세 문제 탭과 본문이 화면 폭 안에서 축소된다', () => {
  const styles = fs.readFileSync(path.resolve('public/styles.css'), 'utf8');
  assert.match(styles, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.tabs button\{[^}]*font-size:clamp\(/);
  assert.match(styles, /main\{padding:0 10px 34px\}/);
  assert.match(styles, /@media\(max-width:380px\)/);
  assert.match(styles, /\.token-group>div\{display:flex;flex-wrap:wrap;overflow-x:visible/);
  assert.match(styles, /\.code-token\{flex:0 1 auto;[^}]*min-height:34px/);
  assert.match(styles, /\.token-bank\{max-height:min\(38vh,320px\);[^}]*overflow-y:auto/);
});
test('GitHub Pages 정적 배포는 상대 경로 데이터만 사용하고 신고 기능을 포함하지 않는다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const html = fs.readFileSync(path.resolve('public/index.html'), 'utf8');
  const server = fs.readFileSync(path.resolve('server.mjs'), 'utf8');
  assert.match(client, /fetch\('\.\/data\/problems\.json', \{ cache: 'no-store' \}\)/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.bundle\.js"/);
  assert.doesNotMatch(`${client}\n${html}\n${server}`, /\/api\/reports|reportDialog/);
});
test('개발 서버는 dist 존재 여부와 무관하게 public 디렉터리를 제공한다', () => {
  const server = fs.readFileSync(path.resolve('server.mjs'), 'utf8');
  assert.match(server, /const publicDir = path\.join\(root, 'public'\);/);
  assert.doesNotMatch(server, /existsSync\(path\.join\(root, 'dist'\)\)/);
});
test('API 피드백은 문제 파일의 explanation만 해설로 출력한다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const feedback = client.match(/function showApiFeedback[\s\S]*?\nfunction /)?.[0] || '';
  assert.match(feedback, /markdown\(problem\.explanation\)/);
  assert.doesNotMatch(feedback, /problem\.solution|problem\.blanks\[index\]\.answer|정답 코드/);
});
test('API 정답 보기는 빈칸 선택 여부와 관계없이 실행된다', () => {
  const client = fs.readFileSync(path.resolve('public/app.js'), 'utf8');
  const grading = client.match(/function gradeApi[\s\S]*?\nfunction /)?.[0] || '';
  assert.match(grading, /const results = problem\.blanks\.map/);
  assert.doesNotMatch(grading, /Object\.keys\(selections\)\.length|모든 빈칸의 답을 선택/);
});

function validateSampleIds(items) {
  const seen = new Set(); const errors = [];
  for (const item of items) { if (seen.has(item.id)) errors.push(item.id); seen.add(item.id); }
  return errors;
}
