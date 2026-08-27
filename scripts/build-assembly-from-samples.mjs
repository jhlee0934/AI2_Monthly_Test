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
    const answerCode = removePrintStatements(sanitizeCode(joinSource(answerCell)));
    if (!answerCode) return;
    const context = markdownContext(problemNotebook.cells, cellIndex, problemSource);
    if (/프롬프트.*(?:작성|만들)/.test(context.content)) { if (promptVariable(answerCode)) pendingPrompt = answerCode; return; }
    if (isPromptOnly(answerCode)) { pendingPrompt = answerCode; return; }
    const pendingName = promptVariable(pendingPrompt);
    const usesPendingPrompt = pendingName && new RegExp(`\\b${pendingName}\\b`).test(answerCode);
    todoItems.push({ label, problemCode, answerCode: [usesPendingPrompt ? pendingPrompt : '', answerCode].filter(Boolean).join('\n\n'), context });
    pendingPrompt = '';
  });

  const idBase = path.basename(problemFile, '.ipynb').replace(/^Ch\.[^_]+_?/, '').replace(/[^A-Za-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
  rebalanceTodoGroups(groupTodoItems(todoItems)).forEach((items, groupIndex) => {
    const contents = items.map((item) => conciseInstruction(stripTodoPrefix(item.context.content)));
    const solution = items.map((item, index) => `# TODO ${index + 1}: ${contents[index]}\n${item.answerCode}`).join('\n\n');
    const protectedRanges = [...commentRanges(solution), ...promptRanges(solution)].sort((a, b) => a.start - b.start);
    const { skeleton, slots } = buildNormalAssembly('', solution, protectedRanges);
    const id = `assembly-${unit}-${String(problemFiles.indexOf(problemFile) + 1).padStart(2, '0')}-${String(groupIndex + 1).padStart(2, '0')}`;
    const title = conceptTitle(idBase, contents, solution);
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

function rebalanceTodoGroups(groups) {
  for (let index = 0; index < groups.length - 1; index += 1) {
    while (groups[index].length > 1 && isImportOnly(groups[index].at(-1).answerCode)) groups[index + 1].unshift(groups[index].pop());
  }
  return groups.filter((group) => group.length);
}

function isImportOnly(code) { return code.split(/\r?\n/).filter((line) => line.trim()).every((line) => /^\s*(?:from\s+\S+\s+import\s+.+|import\s+.+)$/.test(line)); }

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
function conciseInstruction(value) { if (value.length <= 180) return value; return value.match(/^.{1,180}?(?:입니다|합니다|됩니다|봅시다)\./u)?.[0] || `${value.slice(0, 177).trim()}...`; }
function conceptTitle(idBase, contents, solution) {
  const rules = [
    [/load_wine\(|pd\.DataFrame/, 'Wine 데이터셋 로드'],
    [/alcohol_by_class[\s\S]*malic_mean/, '기초 통계와 상관행렬 계산'],
    [/correlation_with_alcohol/, '상관관계 기반 특성 선택'],
    [/\.hist\(bins=/, 'Alcohol 히스토그램'],
    [/sns\.histplot[\s\S]*sns\.boxplot/, '클래스별 분포 시각화'],
    [/sns\.scatterplot/, 'Alcohol·Flavanoids 산점도'],
    [/sns\.pairplot/, '상위 상관 특성 Pairplot'],
    [/np\.random\.seed/, '결측치 생성'],
    [/missing_count[\s\S]*color_intensity_median/, '결측치 현황과 대체값 계산'],
    [/\.fillna\([\s\S]*malic_acid_q1/, '결측치 대체와 사분위수 계산'],
    [/malic_acid_iqr/, 'IQR 이상치 탐지와 제거'],
    [/(?:wine_dataframe_clean[\s\S]*sns\.boxplot|sns\.boxplot[\s\S]*wine_dataframe_clean)/, '이상치 제거 전후 시각화'],
    [/train_test_split/, '학습·테스트 데이터 분할'],
    [/StandardScaler/, 'StandardScaler 전처리'],
    [/LogisticRegression/, '로지스틱 회귀 학습과 평가'],
    [/cross_val_score/, '교차검증과 혼동행렬'],
    [/classification_report/, '분류 보고서와 ROC 데이터 준비'],
    [/roc_curve\(/, 'ROC 곡선과 AUC 평가'],
    [/PCA\([\s\S]*KMeans\(/, 'PCA 차원 축소와 K-Means 군집화'],
    [/load_dotenv\([\s\S]*os\.environ/, 'API 환경변수 설정'],
    [/ChatOpenAI\(/, 'LangChain LLM 클라이언트 초기화'],
    [/최고의 서비스였습니다/, 'Few-shot LLM 호출'],
    [/단계별로 생각해봅시다/, 'Chain-of-Thought LLM 호출'],
    [/감성을 '긍정' 또는 '부정'/, 'Zero-shot LLM 호출'],
    [/client = OpenAI\(/, 'GMS API 클라이언트 초기화'],
    [/chat\.completions\.create/, '생성 파라미터 기반 LLM 호출'],
    [/review_response_format\s*=/, 'JSON Schema 응답 형식 정의'],
    [/response_format=review_response_format/, '구조화 출력 LLM 호출'],
    [/json\.loads[\s\S]*personas\s*=/, '응답 파싱과 합성 조건 정의'],
    [/json\.loads/, 'JSON 응답 파싱'],
    [/json\.dump\(/, '합성 리뷰 JSON 저장'],
    [/PyMuPDFLoader\("data\//, '단일 PDF 문서 로드'],
    [/glob\.glob\("data\/\*\.pdf"\)/, '여러 PDF 문서 일괄 로드'],
    [/def keyword_search/, '키워드 검색 함수 구현'],
    [/queries\s*=.*총알배송/, '키워드별 검색 결과 비교'],
    [/OpenAIEmbeddings\(/, '텍스트 임베딩 생성'],
    [/Chroma\.from_documents/, 'Chroma 벡터 데이터베이스 생성'],
    [/\.as_retriever\(/, 'Retriever 의미 검색 구성'],
    [/for size in \[200, 500, 1000\]/, '청크 크기별 분할 비교'],
    [/RecursiveCharacterTextSplitter\(/, '재귀적 문서 청킹'],
    [/class RAGState\(/, 'RAG 상태 스키마 정의'],
    [/def retrieve\(/, 'RAG 검색 노드 구현'],
    [/def generate\(/, 'RAG 생성 노드 구현'],
    [/StateGraph\(RAGState\)/, 'RAG StateGraph 조립'],
    [/ChatPromptTemplate\.from_template/, '문서 기반 LLM 응답 생성'],
    [/results\.append\(/, '페르소나·상품별 리뷰 생성'],
  ];
  return rules.find(([pattern]) => pattern.test(solution))?.[1] || idBase.replace(/^\d+-/, '').replaceAll('-', ' ');
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
  const content = normalizePrintInstruction([todo, prose].find(isLearningText) || (title ? `TODO: ${title}` : 'TODO 지시 사항에 맞게 코드를 완성하세요.'));
  return { title, requirements, content };
}

function sanitizeCode(source) { return source.split(/\r?\n/).filter((line) => !/^\s*(?:#|%|!)/.test(line)).map(stripInlineComment).join('\n').replace(/\n{3,}/g, '\n\n').trim(); }
function removePrintStatements(code) {
  const lines = code.split(/\r?\n/); const kept = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*print\s*\(/.test(lines[index])) { kept.push(lines[index]); continue; }
    let depth = parenthesisDelta(lines[index]);
    while (depth > 0 && index + 1 < lines.length) { index += 1; depth += parenthesisDelta(lines[index]); }
  }
  let result = kept;
  let changed = true;
  while (changed) {
    changed = false;
    result = result.filter((line, index) => {
      if (!/:\s*$/.test(line.trimEnd())) return true;
      const indent = line.match(/^\s*/)[0].length;
      const next = result.slice(index + 1).find((candidate) => candidate.trim());
      if (!next || next.match(/^\s*/)[0].length <= indent) { changed = true; return false; }
      return true;
    });
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function parenthesisDelta(line) { let quote = ''; let escaped = false; let delta = 0; for (const char of line) { if (escaped) { escaped = false; continue; } if (char === '\\') { escaped = true; continue; } if (quote) { if (char === quote) quote = ''; continue; } if (char === '"' || char === "'") { quote = char; continue; } if (char === '(') delta += 1; else if (char === ')') delta -= 1; } return delta; }
function normalizePrintInstruction(value) { return value.replace(/출력해봅시다/g, '구해봅시다').replace(/출력하세요/g, '구하세요').replace(/출력하여/g, '구하여').replace(/출력하고/g, '구하고').replace(/출력/g, '확인'); }
function stripInlineComment(line) { let quote = ''; let escaped = false; for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (escaped) { escaped = false; continue; } if (char === '\\') { escaped = true; continue; } if (quote) { if (char === quote) quote = ''; continue; } if (char === '"' || char === "'") { quote = char; continue; } if (char === '#') return line.slice(0, index).trimEnd(); } return line.trimEnd(); }
function tokenize(code) { return [...code.matchAll(tokenPattern)].map((match) => ({ value: match[0], start: match.index, end: match.index + match[0].length })); }
function cleanMarkdown(value) { return value.replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim(); }
function isLearningText(value) { return Boolean(value) && !/(무단 사용|불법 배포|Author:|Contact:|Version:|Last Updated:|저작권)/i.test(value); }
function todoLabel(source) { return /^\s*#\s*TODO\s*(\d+(?:-\d+)?)/im.exec(source)?.[1] || ''; }
function joinSource(cell) { return Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || ''); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function listFiles(directory) { return fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name)); }
