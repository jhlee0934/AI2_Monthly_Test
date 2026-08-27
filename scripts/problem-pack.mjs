import fs from 'node:fs';
import path from 'node:path';

const TYPES = new Set(['flow', 'api', 'assembly']);

export function loadActiveProblemPack(root) {
  const configPath = path.join(root, 'problem-pack.config.json');
  const config = readJson(configPath, '문제 팩 설정');
  const packsRoot = safeResolve(root, config.packsDirectory || 'problem-packs');
  const activePack = process.env.PROBLEM_PACK || config.activePack;
  if (typeof activePack !== 'string' || !/^[A-Za-z0-9._-]+$/.test(activePack)) throw new Error('활성 문제 팩 이름이 올바르지 않습니다.');
  return loadProblemPack(path.join(packsRoot, activePack), packsRoot);
}

export function loadProblemPack(packDir, allowedRoot = path.dirname(packDir)) {
  const resolvedPackDir = safeResolve(allowedRoot, path.relative(allowedRoot, packDir));
  const manifest = readJson(path.join(resolvedPackDir, 'pack.json'), '문제 팩 매니페스트');
  if (manifest.schemaVersion !== 1) throw new Error('지원하지 않는 문제 팩 스키마 버전입니다.');
  for (const field of ['id', 'title']) if (typeof manifest[field] !== 'string' || !manifest[field].trim()) throw new Error(`문제 팩의 ${field} 값이 필요합니다.`);

  let problems;
  if (manifest.problemFile) {
    const payload = readJson(safeResolve(resolvedPackDir, manifest.problemFile), '문제 데이터');
    problems = Array.isArray(payload) ? payload : payload.problems;
  } else if (manifest.problemDirectory) {
    const questionsDir = safeResolve(resolvedPackDir, manifest.problemDirectory);
    problems = listJsonFiles(questionsDir).flatMap((file) => {
      const payload = readJson(file, `문제 파일 ${path.basename(file)}`);
      return Array.isArray(payload) ? payload : [payload];
    });
  } else throw new Error('pack.json에 problemFile 또는 problemDirectory가 필요합니다.');

  const errors = validateProblems(problems);
  if (errors.length) throw new Error(`문제 팩 검증 실패:\n- ${errors.join('\n- ')}`);
  return { manifest, problems };
}

export function validateProblems(problems) {
  if (!Array.isArray(problems) || !problems.length) return ['문제가 한 개 이상 필요합니다.'];
  const errors = [];
  const ids = new Set();
  problems.forEach((problem, index) => {
    const at = `${index + 1}번째 문제`;
    if (!problem || typeof problem !== 'object' || Array.isArray(problem)) { errors.push(`${at}: 객체 형식이어야 합니다.`); return; }
    for (const field of ['id', 'unit', 'type', 'title']) if (typeof problem[field] !== 'string' || !problem[field].trim()) errors.push(`${at}: ${field}는 비어 있지 않은 문자열이어야 합니다.`);
    if (typeof problem.content !== 'string') errors.push(`${at}: content는 문자열이어야 합니다.`);
    if (problem.id) { if (ids.has(problem.id)) errors.push(`${at}: ID '${problem.id}'가 중복됩니다.`); ids.add(problem.id); }
    if (!TYPES.has(problem.type)) errors.push(`${at}: type은 flow, api 또는 assembly여야 합니다.`);
    if (!Array.isArray(problem.requirements)) errors.push(`${at}: requirements는 문자열 배열이어야 합니다.`);
    else if (problem.requirements.some((item) => typeof item !== 'string')) errors.push(`${at}: requirements의 모든 항목은 문자열이어야 합니다.`);
    if (problem.constraints != null && (!Array.isArray(problem.constraints) || problem.constraints.some((item) => typeof item !== 'string'))) errors.push(`${at}: constraints는 문자열 배열이어야 합니다.`);
    for (const field of ['skeleton', 'example', 'solution', 'explanation']) if (problem[field] != null && typeof problem[field] !== 'string') errors.push(`${at}: ${field}는 문자열이어야 합니다.`);
    if (problem.type === 'flow') {
      if (!Array.isArray(problem.keywords) || !problem.keywords.length) errors.push(`${at}: 개념 확인 주관식(flow) 문제에는 keywords가 한 개 이상 필요합니다.`);
      if (!Array.isArray(problem.acceptedAnswers)) errors.push(`${at}: acceptedAnswers는 배열이어야 합니다.`);
    }
    if (problem.type === 'api') {
      if (!Array.isArray(problem.blanks) || !problem.blanks.length) errors.push(`${at}: api 문제에는 blanks가 한 개 이상 필요합니다.`);
      else problem.blanks.forEach((blank, blankIndex) => {
        if (!blank || typeof blank.id !== 'string' || typeof blank.answer !== 'string' || !Array.isArray(blank.choices)) errors.push(`${at} 빈칸 ${blankIndex + 1}: id, answer, choices 형식을 확인하세요.`);
        else if (!blank.id.trim() || !blank.answer.trim() || blank.choices.some((choice) => typeof choice !== 'string')) errors.push(`${at} 빈칸 ${blankIndex + 1}: id, answer, choices에는 문자열 값이 필요합니다.`);
        else if (!blank.choices.includes(blank.answer)) errors.push(`${at} 빈칸 ${blankIndex + 1}: choices에 answer가 포함되어야 합니다.`);
      });
    }
    if (problem.type === 'assembly') {
      if (!Array.isArray(problem.slots) || !problem.slots.length) errors.push(`${at}: assembly 문제에는 slots가 한 개 이상 필요합니다.`);
      else {
        const slotIds = new Set();
        problem.slots.forEach((slot, slotIndex) => {
          if (!slot || typeof slot.id !== 'string' || typeof slot.answer !== 'string' || !slot.id.trim() || !slot.answer.trim()) errors.push(`${at} 슬롯 ${slotIndex + 1}: id와 answer에는 비어 있지 않은 문자열이 필요합니다.`);
          else if (slotIds.has(slot.id)) errors.push(`${at} 슬롯 ${slotIndex + 1}: ID '${slot.id}'가 중복됩니다.`);
          else slotIds.add(slot.id);
        });
      }
      if (!Array.isArray(problem.tokens) || !problem.tokens.length || problem.tokens.some((token) => typeof token !== 'string' || !token.trim())) errors.push(`${at}: assembly 문제의 tokens에는 비어 있지 않은 문자열이 필요합니다.`);
      else if (Array.isArray(problem.slots) && problem.slots.some((slot) => slot?.answer && !problem.tokens.includes(slot.answer))) errors.push(`${at}: 모든 슬롯 정답은 tokens에 포함되어야 합니다.`);
      if (problem.normalSlotIds != null) {
        const slotIds = new Set(Array.isArray(problem.slots) ? problem.slots.map((slot) => slot?.id) : []);
        if (!Array.isArray(problem.normalSlotIds) || !problem.normalSlotIds.length || problem.normalSlotIds.some((id) => typeof id !== 'string' || !slotIds.has(id)) || new Set(problem.normalSlotIds).size !== problem.normalSlotIds.length) errors.push(`${at}: normalSlotIds에는 중복 없이 유효한 슬롯 ID가 필요합니다.`);
      }
      const markers = typeof problem.skeleton === 'string' ? [...problem.skeleton.matchAll(/_{2,}\[(\d+)\]/g)] : [];
      if (Array.isArray(problem.slots) && markers.length !== problem.slots.length) errors.push(`${at}: skeleton 빈칸 수와 slots 수가 일치해야 합니다.`);
    }
  });
  return errors;
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`${label}을 읽을 수 없습니다: ${file}\n${error.message}`); }
}
function safeResolve(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, target);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('문제 팩 경로가 허용된 폴더를 벗어났습니다.');
  return resolved;
}
function listJsonFiles(root) {
  if (!fs.existsSync(root)) throw new Error(`문제 폴더를 찾을 수 없습니다: ${root}`);
  return fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => path.join(entry.parentPath, entry.name)).sort();
}
