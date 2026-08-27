import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const samplesRoot = path.join(root, 'samples');
const outputRoot = path.join(root, 'problems', 'assembly');
const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
const keywords = new Set(['import', 'from', 'as', 'def', 'return', 'for', 'in', 'if', 'else', 'elif', 'with', 'try', 'except', 'class', 'lambda', 'True', 'False', 'None', 'and', 'or', 'not', 'is']);

if (!fs.existsSync(samplesRoot)) throw new Error('samples 폴더를 찾을 수 없습니다.');

const problemFiles = listFiles(samplesRoot)
  .filter((file) => path.basename(path.dirname(file)) === '문제' && file.endsWith('.ipynb'))
  .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
const generated = [];

for (const problemFile of problemFiles) {
  const chapterDir = path.dirname(path.dirname(problemFile));
  const answerFile = path.join(chapterDir, '정답', path.basename(problemFile));
  if (!fs.existsSync(answerFile)) throw new Error(`정답 노트북을 찾을 수 없습니다: ${answerFile}`);
  const problemNotebook = readJson(problemFile);
  const answerNotebook = readJson(answerFile);
  const answerByTodo = new Map(answerNotebook.cells.filter((cell) => cell.cell_type === 'code').map((cell) => [todoLabel(joinSource(cell)), cell]).filter(([label]) => label));
  const answerCodeCells = answerNotebook.cells.filter((cell) => cell.cell_type === 'code');
  const unit = /^Ch_(\d+-\d+)/.exec(path.basename(chapterDir))?.[1];
  if (!unit) throw new Error(`단원 번호를 확인할 수 없습니다: ${chapterDir}`);
  let codeOrdinal = 0; let todoOrdinal = 0; let pendingPrompt = '';
  const todoItems = [];

  problemNotebook.cells.forEach((cell, cellIndex) => {
    if (cell.cell_type !== 'code') return;
    const currentCodeOrdinal = codeOrdinal++;
    const problemSource = joinSource(cell);
    const label = todoLabel(problemSource);
    if (!label) return;
    todoOrdinal += 1;
    const answerCell = answerByTodo.get(label) || answerNotebook.cells[cellIndex] || answerCodeCells[currentCodeOrdinal];
    if (!answerCell || answerCell.cell_type !== 'code') throw new Error(`TODO 정답 셀을 찾을 수 없습니다: ${problemFile} / ${todoOrdinal}`);
    const problemCode = sanitizeCode(problemSource);
    const answerCode = sanitizeCode(joinSource(answerCell));
    if (!answerCode) throw new Error(`TODO 정답 코드가 비어 있습니다: ${answerFile} / ${todoOrdinal}`);
    const context = markdownContext(problemNotebook.cells, cellIndex, problemSource);
    if (isPromptOnly(answerCode)) { pendingPrompt = answerCode; return; }
    const pendingName = promptVariable(pendingPrompt);
    const usesPendingPrompt = pendingName && new RegExp(`\\b${pendingName}\\b`).test(answerCode);
    todoItems.push({ label, problemCode, answerCode: [usesPendingPrompt ? pendingPrompt : '', answerCode].filter(Boolean).join('\n\n'), context });
    pendingPrompt = '';
  });

  const idBase = path.basename(problemFile, '.ipynb').replace(/^Ch\.[^_]+_?/, '').replace(/[^A-Za-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
  groupTodoItems(todoItems).forEach((items, groupIndex) => {
    const contents = items.map((item) => stripTodoPrefix(item.context.content));
    const solution = items.map((item, index) => `# TODO ${index + 1}: ${contents[index]}\n${item.answerCode}`).join('\n\n');
    const protectedRanges = [...commentRanges(solution), ...promptRanges(solution)].sort((a, b) => a.start - b.start);
    const { skeleton, slots } = buildNormalAssembly('', solution, protectedRanges);
    const id = `assembly-${unit}-${String(problemFiles.indexOf(problemFile) + 1).padStart(2, '0')}-${String(groupIndex + 1).padStart(2, '0')}`;
    const title = conceptTitle(idBase, contents);
    const requirements = [...new Set(items.flatMap((item) => item.context.requirements))];
    generated.push({
      id, unit, type: 'assembly', title,
      content: contents.length > 1 ? contents.map((content, index) => `${index + 1}. ${content}`).join('\n') : contents[0],
      requirements: requirements.length ? requirements : ['TODO 지시 사항에 맞게 함수, 메서드, 인자와 값을 배치한다.'],
      skeleton, slots, tokens: buildTokenBank(slots, id), solution, protectedRanges,
      explanation: `정답 노트북의 TODO ${items.map((item) => item.label).join(', ')} 구현입니다. 함수 호출 대상, 메서드, 인자 이름과 반환값 사용 위치를 함께 확인하세요.`,
      example: '', source: path.relative(samplesRoot, problemFile).replaceAll('\\', '/'),
    });
  });
}

if (!generated.length) throw new Error('변환할 TODO 코드 셀이 없습니다.');
fs.mkdirSync(outputRoot, { recursive: true });
for (const file of fs.readdirSync(outputRoot)) if (file.endsWith('.json')) fs.unlinkSync(path.join(outputRoot, file));
for (const unit of [...new Set(generated.map((problem) => problem.unit))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  const problems = generated.filter((problem) => problem.unit === unit);
  fs.writeFileSync(path.join(outputRoot, `${unit}.json`), `${JSON.stringify({ problems }, null, 2)}\n`);
}
console.log(`${problemFiles.length}개 문제 노트북을 ${generated.length}개 TODO 조립 문제로 변환했습니다.`);

function buildNormalAssembly(problemCode, answerCode, protectedRanges = []) {
  const problemTokens = tokenize(problemCode);
  const answerTokens = tokenize(answerCode);
  const matched = lcsMatchedAnswerIndexes(problemTokens.map((token) => token.value), answerTokens.map((token) => token.value));
  const canBlank = (token) => !protectedRanges.some((range) => token.start >= range.start && token.start < range.end);
  let targetIndexes = answerTokens.map((token, index) => ({ token, index })).filter(({ token, index }) => !matched.has(index) && canBlank(token)).map(({ index }) => index);
  if (!problemTokens.length || !targetIndexes.length) targetIndexes = normalTargetIndexes(answerCode, answerTokens).filter((index) => canBlank(answerTokens[index]));
  if (!targetIndexes.length) targetIndexes = answerTokens.map((token, index) => ({ token, index })).filter(({ token }) => canBlank(token)).map(({ index }) => index);
  const targetSet = new Set(targetIndexes); const slots = []; let skeleton = ''; let cursor = 0;
  answerTokens.forEach((token, index) => {
    if (!targetSet.has(index)) return;
    skeleton += answerCode.slice(cursor, token.start);
    const slot = { id: `slot-${slots.length + 1}`, answer: token.value };
    slots.push(slot); skeleton += `____[${slots.length}]`; cursor = token.end;
  });
  skeleton += answerCode.slice(cursor);
  return { skeleton, slots };
}

function normalTargetIndexes(code, tokens) {
  return tokens.map((token, index) => ({ token, index })).filter(({ token }) => {
    if (/^['"]|^\d/.test(token.value) || ['True', 'False', 'None'].includes(token.value)) return true;
    if (keywords.has(token.value)) return false;
    const before = code.slice(0, token.start);
    const after = code.slice(token.end);
    const lineBefore = before.slice(before.lastIndexOf('\n') + 1);
    if (!lineBefore.trim() && /^\s*(?:=|\[)/.test(after)) return false;
    if (/\.\s*$/.test(before) || /^\s*\(/.test(after)) return true;
    if (/(?:\bfrom\s+[\w.]*|\bimport\s+[\w., ]*)$/.test(lineBefore) && !/\bas\s*$/.test(lineBefore)) return true;
    if (/^\s*=/.test(after) && /[(,]\s*$/.test(before)) return true;
    return false;
  }).map(({ index }) => index);
}

function groupTodoItems(items) {
  const groups = []; let current = [];
  const flush = () => { if (current.length) groups.push(current); current = []; };
  for (const item of items) {
    const lines = codeLineCount(item.answerCode);
    if (lines > 4) { flush(); groups.push([item]); continue; }
    const combinedLines = current.reduce((sum, entry) => sum + codeLineCount(entry.answerCode), 0) + lines;
    if (current.length >= 4 || combinedLines > 12) flush();
    current.push(item);
  }
  flush();
  return groups;
}

function isPromptOnly(code) {
  const ranges = findStringRanges(code);
  let remainder = code;
  for (const range of [...ranges].reverse()) remainder = `${remainder.slice(0, range.start)}${remainder.slice(range.end)}`;
  const assignment = /^\s*([A-Za-z_]\w*)\s*=\s*$/.exec(remainder);
  return Boolean(assignment?.[1].toLowerCase().includes('prompt'));
}

function promptVariable(code) {
  const ranges = findStringRanges(code);
  let remainder = code;
  for (const range of [...ranges].reverse()) remainder = `${remainder.slice(0, range.start)}${remainder.slice(range.end)}`;
  const assignment = /^\s*([A-Za-z_]\w*)\s*=\s*$/.exec(remainder);
  return assignment?.[1].toLowerCase().includes('prompt') ? assignment[1] : '';
}

function promptRanges(code) {
  return findStringRanges(code).filter((range) => {
    const before = code.slice(Math.max(0, code.lastIndexOf('\n', range.start) + 1), range.start);
    const nearby = code.slice(Math.max(0, range.start - 100), range.start);
    const assignment = /\b([A-Za-z_]\w*)\s*=\s*[furb]*\s*$/i.exec(before);
    return range.triple || Boolean(assignment?.[1].toLowerCase().includes('prompt')) || /\.from_template\s*\(\s*[furb]*\s*$/i.test(nearby);
  }).map(({ start, end }) => ({ start, end }));
}

function commentRanges(code) {
  const ranges = [];
  for (const match of code.matchAll(/^\s*#.*$/gm)) ranges.push({ start: match.index, end: match.index + match[0].length });
  return ranges;
}

function findStringRanges(code) {
  const pattern = /[furbFURB]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  return [...code.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length, triple: /["']{3}/.test(match[0].slice(0, 5)) }));
}

function codeLineCount(code) { return code.split(/\r?\n/).filter((line) => line.trim()).length; }
function stripTodoPrefix(value) { return value.replace(/^TODO\s*\d+(?:-\d+)?\s*:\s*/i, '').trim(); }
function conceptTitle(idBase, contents) {
  const text = contents[0] || '';
  const rules = [
    [/패키지.*import|wine.*로드/i, 'Wine 데이터셋 로드'],
    [/기술통계|고유 클래스|클래스별.*평균|처음 .*행/i, 'Wine 데이터 탐색'],
    [/histogram|histplot|boxplot|pairplot|시각화/i, '데이터 시각화'],
    [/상관행렬|상관관계/i, '특성 상관관계 분석'],
    [/결측/i, '결측치 생성 및 처리'],
    [/IQR|이상치/i, '이상치 탐지 및 처리'],
    [/train_test_split|학습용.*테스트용|분할/i, '학습·평가 데이터 분할'],
    [/StandardScaler|스케일/i, '특성 스케일링'],
    [/LogisticRegression|모델.*학습|정확도/i, '분류 모델 학습 및 평가'],
    [/교차검증|cross_val_score/i, '교차검증'],
    [/혼동 행렬|분류 보고서/i, '분류 성능 평가'],
    [/ROC|AUC/i, 'ROC·AUC 평가'],
    [/PCA/i, 'PCA 차원 축소'],
    [/KMeans/i, 'K-Means 군집화'],
    [/환경변수|API 키|dotenv/i, 'API 환경변수 설정'],
    [/LLM|invoke|호출/i, 'LLM 호출'],
    [/JSON.*파싱|response.format/i, '구조화 응답 처리'],
    [/PDF|문서 로더/i, 'PDF 문서 로드'],
    [/키워드 검색/i, '키워드 검색'],
    [/임베딩|벡터 데이터베이스/i, '벡터 검색 구성'],
    [/Retriever|검색기/i, 'Retriever 구성'],
    [/청크|TextSplitter/i, '문서 청킹'],
    [/RAGState|StateGraph|노드 함수/i, 'RAG 그래프 구성'],
  ];
  const concept = rules.find(([pattern]) => pattern.test(text))?.[1] || idBase.replace(/^\d+-/, '').replaceAll('-', ' ');
  if (concept === 'Wine 데이터셋 로드') return concept;
  const detail = contents[0].replace(/해봅시다[.!]?$/u, '').replace(/하세요[.!]?$/u, '').replace(/[.!?]+$/u, '').trim().slice(0, 30);
  return detail && !concept.includes(detail) ? `${concept}: ${detail}` : concept;
}

function lcsMatchedAnswerIndexes(problem, answer) {
  const rows = Array.from({ length: problem.length + 1 }, () => new Uint16Array(answer.length + 1));
  for (let i = problem.length - 1; i >= 0; i -= 1) for (let j = answer.length - 1; j >= 0; j -= 1) rows[i][j] = problem[i] === answer[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
  const matched = new Set(); let i = 0; let j = 0;
  while (i < problem.length && j < answer.length) {
    if (problem[i] === answer[j]) { matched.add(j); i += 1; j += 1; }
    else if (rows[i + 1][j] >= rows[i][j + 1]) i += 1;
    else j += 1;
  }
  return matched;
}

function buildTokenBank(slots, seedText) {
  const answers = [...new Set(slots.map((slot) => slot.answer))];
  const generic = ['fit', 'transform', 'predict', 'invoke', 'load', 'True', 'False', 'None', '0', '1', '"auto"'];
  const candidates = generic.filter((token) => !answers.includes(token));
  let seed = [...seedText].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const distractors = [];
  const target = Math.min(4, Math.max(2, Math.ceil(answers.length / 4)));
  while (distractors.length < target && candidates.length) { seed = (seed * 9301 + 49297) % 233280; distractors.push(candidates.splice(seed % candidates.length, 1)[0]); }
  return [...answers, ...distractors];
}

function markdownContext(cells, codeIndex, problemSource) {
  const markdown = [];
  for (let index = codeIndex - 1; index >= 0 && markdown.length < 2; index -= 1) {
    if (cells[index].cell_type === 'code') break;
    if (cells[index].cell_type === 'markdown') markdown.unshift(joinSource(cells[index]));
  }
  const text = markdown.join('\n');
  const headings = [...text.matchAll(/^#{2,5}\s+(.+)$/gm)].map((match) => match[1].replace(/^TODO\s*\d*(?:-\d+)?\s*:?\s*/i, '').trim());
  const title = headings.at(-1) || '';
  const requirements = text.split('\n').filter((line) => /^\s*[-*]\s+/.test(line)).map((line) => cleanMarkdown(line.replace(/^\s*[-*]\s+/, ''))).filter(isLearningText).slice(0, 5);
  const todo = problemSource.split(/\r?\n/).map((line) => line.match(/^\s*#\s*(TODO[^\n]*)/i)?.[1] || '').map(cleanMarkdown).filter((line) => line && !/^TODO\s*\d*(?:-\d+)?\s*:?$/i.test(line)).join(' ');
  const prose = cleanMarkdown(text.replace(/^#{1,6}\s+.*$/gm, '').replace(/^\s*[-*]\s+/gm, '')).slice(0, 700);
  const content = [todo, prose].find(isLearningText) || (title ? `TODO: ${title}` : 'TODO 지시 사항에 맞게 코드를 완성하세요.');
  return { title, requirements, content };
}

function sanitizeCode(source) { return source.split(/\r?\n/).filter((line) => !/^\s*(?:#|%|!)/.test(line)).map(stripInlineComment).join('\n').replace(/\n{3,}/g, '\n\n').trim(); }
function stripInlineComment(line) { let quote = ''; let escaped = false; for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (escaped) { escaped = false; continue; } if (char === '\\') { escaped = true; continue; } if (quote) { if (char === quote) quote = ''; continue; } if (char === '"' || char === "'") { quote = char; continue; } if (char === '#') return line.slice(0, index).trimEnd(); } return line.trimEnd(); }
function tokenize(code) { return [...code.matchAll(tokenPattern)].map((match) => ({ value: match[0], start: match.index, end: match.index + match[0].length })); }
function cleanMarkdown(value) { return value.replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim(); }
function isLearningText(value) { return Boolean(value) && !/(무단 사용|불법 배포|Author:|Contact:|Version:|Last Updated:|저작권)/i.test(value); }
function todoLabel(source) { return /^\s*#\s*TODO\s*(\d+(?:-\d+)?)/im.exec(source)?.[1] || ''; }
function joinSource(cell) { return Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || ''); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function listFiles(directory) { return fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name)); }
