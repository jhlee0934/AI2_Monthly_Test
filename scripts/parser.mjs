import fs from 'node:fs';
import path from 'node:path';

const TYPE_MAP = {
  '01_구현흐름': 'flow',
  '02_API빈칸': 'api',
};
export const BLANK_MARKER_PATTERN = /_{2,}\[(\d+)\]/g;

export function loadProjectProblems(root) {
  return parseProblems(path.join(root, 'problems'));
}

const clean = (value = '') => value
  .replace(/<a id="[^"]+"><\/a>/g, '')
  .replace(/\[(?:정답으로 이동|문제로 돌아가기)\]\([^\n)]*\)/g, '')
  .replace(/^---[ \t]*\r?$/gm, '')
  .trim();
const codeBlock = (text = '') => text.match(/```(?:\w+)?\s*\n([\s\S]*?)```/)?.[1]?.trimEnd() ?? '';
const section = (text, title) => {
  const heading = new RegExp(`^#{2,3}[ \\t]+${title}[ \\t]*\\r?$`, 'm').exec(text);
  if (!heading) return '';
  const start = heading.index + heading[0].length;
  const remaining = text.slice(start).replace(/^\\r?\\n/, '');
  const nextHeading = remaining.search(/^#{2,3}[ \\t]+|^---[ \\t]*\\r?$/m);
  return clean(nextHeading >= 0 ? remaining.slice(0, nextHeading) : remaining);
};
const list = (text = '') => text.split('\n').filter((line) => /^\s*-\s+/.test(line)).map((line) => line.replace(/^\s*-\s+/, '').trim());
const unique = (items) => [...new Set(items.filter(Boolean))];
const inlineKeywords = (text) => unique([...text.matchAll(/`([^`\n]{2,80})`/g)].map((m) => m[1]).filter((v) => !/\s/.test(v))).slice(0, 12);

function splitQuestions(markdown) {
  const anchors = [...markdown.matchAll(/<a id="question-?(\d*)"><\/a>/g)];
  if (!anchors.length) return [{ number: '1', question: markdown.split(/<a id="answer(?:\d*)"><\/a>/)[0], answer: markdown.split(/<a id="answer(?:\d*)"><\/a>/)[1] ?? '' }];
  return anchors.map((anchor, index) => {
    const number = anchor[1] || String(index + 1);
    const precedingStart = index ? anchors[index - 1].index + anchors[index - 1][0].length : 0;
    const preceding = markdown.slice(precedingStart, anchor.index);
    const standaloneTitle = [...preceding.matchAll(/^# 문제(?:[ \t]+\d+\.)?[ \t]+(.+)$/gm)].at(-1)?.[1]?.trim();
    const start = anchor.index + anchor[0].length;
    const answerMarker = new RegExp(`<a id="answer-?${anchor[1]}"><\\/a>`, 'g');
    const answerMatch = answerMarker.exec(markdown);
    const nextQuestion = anchors[index + 1]?.index ?? markdown.length;
    const questionEnd = Math.min(nextQuestion, answerMatch?.index ?? markdown.length);
    if (!answerMatch) return { number, question: markdown.slice(start, questionEnd), answer: '' };
    const answerStart = answerMatch.index + answerMatch[0].length;
    const nextAnswerMatch = /<a id="answer-?\d*"><\/a>/g;
    nextAnswerMatch.lastIndex = answerStart;
    const nextAnswer = nextAnswerMatch.exec(markdown);
    const nextStandaloneQuestion = markdown.slice(answerStart).search(/^# 문제(?:[ \t]+\d+\.)?[ \t]+/m);
    const standaloneEnd = nextStandaloneQuestion >= 0 ? answerStart + nextStandaloneQuestion : markdown.length;
    const answerEnd = Math.min(nextAnswer?.index ?? markdown.length, nextQuestion > answerStart ? nextQuestion : markdown.length, standaloneEnd);
    return { number, title: standaloneTitle, question: markdown.slice(start, questionEnd), answer: markdown.slice(answerStart, answerEnd) };
  });
}

function extractTemplateAnswers(skeleton, solution) {
  const result = new Map();
  const solutionLines = solution.split('\n');
  for (const sourceLine of skeleton.split('\n')) {
    const placeholders = [...sourceLine.matchAll(BLANK_MARKER_PATTERN)];
    if (!placeholders.length) continue;
    let pattern = '^\\s*';
    let cursor = 0;
    for (const blank of placeholders) {
      pattern += escapeRegex(sourceLine.slice(cursor, blank.index)).replace(/\\ /g, '\\s*') + '(.+?)';
      cursor = blank.index + blank[0].length;
    }
    pattern += escapeRegex(sourceLine.slice(cursor)).replace(/\\ /g, '\\s*') + '\\s*$';
    const regex = new RegExp(pattern);
    const found = solutionLines.map((line) => line.match(regex)).find(Boolean);
    if (found) placeholders.forEach((blank, index) => {
      const key = blank[1];
      if (!result.has(key)) result.set(key, found[index + 1].trim());
    });
  }
  return [...result.values()];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function distractors(answer, pool) {
  const generic = ['None', 'False', 'return', 'compile', 'transform', 'forward', 'fit', 'get', 'END', 'START'];
  const candidates = unique([...pool, ...generic]).filter((item) => item !== answer && item.length < 80);
  let seed = [...answer].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const picked = [];
  while (picked.length < 3 && candidates.length) {
    seed = (seed * 9301 + 49297) % 233280;
    picked.push(candidates.splice(seed % candidates.length, 1)[0]);
  }
  return unique([answer, ...picked]);
}

export function parseProblems(root) {
  const jsonProblems = fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(entry.parentPath, entry.name)).sort()
    .flatMap((file) => {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(payload) ? payload : payload.problems ?? [payload];
    });
  const files = fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(entry.parentPath, entry.name)).sort();
  const raw = [];
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const type = Object.entries(TYPE_MAP).find(([needle]) => relative.includes(needle))?.[1];
    if (!type) continue;
    const unit = relative.split('/')[0].replace(/\s*연습문제$/, '');
    const topic = path.basename(file, '.md').replace(/_?0[123]_?(구현흐름|API빈칸|실전코딩)/, '').replace(/^\d+_|_+$/g, '') || '공통';
    const markdown = fs.readFileSync(file, 'utf8');
    for (const part of splitQuestions(markdown)) {
      const titleMatch = part.question.match(/^## 문제(?:[ \\t]+\d+\.)?[ \\t]+(.+)$/m);
      const problemText = section(part.question, '문제');
      const requirements = list(section(part.question, '요구사항'));
      const skeleton = codeBlock(section(part.question, '제공 코드(?: 또는 스켈레톤)?'));
      const example = codeBlock(section(part.question, '예상 입력·출력')) || section(part.question, '예상 입력·출력');
      const solution = codeBlock(section(part.answer, '정답 코드'));
      const explanation = section(part.answer, '핵심 해설');
      raw.push({
        id: `${unit}-${topic}-${type}-${part.number}`.replace(/\s+/g, '-'), unit, type,
        title: part.title || titleMatch?.[1]?.trim() || markdown.match(/^#\s+(.+?)(?::\s*(?:구현 흐름|API 빈칸))?$/m)?.[1] || `문제 ${part.number}`,
        content: problemText, requirements,
        skeleton, example, solution, explanation, source: relative,
      });
    }
  }
  const answerPool = unique(raw.filter((q) => q.type === 'api').flatMap((q) => extractTemplateAnswers(q.skeleton, q.solution)));
  const markdownProblems = raw.map((q) => {
    if (q.type === 'api') {
      const answers = extractTemplateAnswers(q.skeleton, q.solution);
      return { ...q, blanks: answers.map((answer, index) => ({ id: String(index + 1), answer, choices: distractors(answer, answerPool) })) };
    }
    if (q.type === 'flow') {
      const keywords = inlineKeywords(`${q.explanation}\n${q.requirements.join('\n')}`);
      return { ...q, acceptedAnswers: q.solution ? [q.solution] : [], keywords };
    }
    return q;
  });
  return [...jsonProblems, ...markdownProblems];
}
