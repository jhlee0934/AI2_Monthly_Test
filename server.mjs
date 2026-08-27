import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadActiveProblemPack } from './scripts/problem-pack.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(root, '.env'));
const publicDir = fs.existsSync(path.join(root, 'dist')) ? path.join(root, 'dist') : path.join(root, 'public');
const rateLimits = new Map();
const reportRateLimits = new Map();
const PORT = Number(process.env.PORT) || 3000;
const REPORT_CATEGORIES = new Map([
  ['content-error', '문제 내용 오류'],
  ['wrong-answer', '정답 오류'],
  ['grading-error', '채점 오류'],
  ['insufficient-explanation', '해설 부족'],
  ['typo', '오탈자'],
  ['ui-error', '화면·기능 오류'],
  ['other', '기타'],
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/api/problems') {
      const pack = loadActiveProblemPack(root);
      return json(response, 200, { pack: publicManifest(pack.manifest), problems: pack.problems });
    }
    if (request.method === 'POST' && url.pathname === '/api/review') return await reviewCode(request, response);
    if (request.method === 'POST' && url.pathname === '/api/reports') return await createProblemReport(request, response);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: '지원하지 않는 요청입니다.' });
    return serveStatic(url.pathname, response, request.method === 'HEAD');
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: '서버에서 요청을 처리하지 못했습니다.' });
  }
});

async function createProblemReport(request, response) {
  const remoteAddress = request.socket.remoteAddress || 'unknown';
  if (!allowRequest(reportRateLimits, remoteAddress, 3, 60_000)) return json(response, 429, { error: '신고 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  if (!sameOrigin(request)) return json(response, 403, { error: '허용되지 않은 요청입니다.' });

  let body;
  try { body = await readJson(request, 10_000); }
  catch { return json(response, 400, { error: '신고 형식이 올바르지 않습니다.' }); }
  if (body.website) return json(response, 201, { message: '문제 신고가 접수되었습니다.' });
  if (typeof body.packId !== 'string' || typeof body.problemId !== 'string') return json(response, 400, { error: '문제 정보가 올바르지 않습니다.' });
  if (!REPORT_CATEGORIES.has(body.category)) return json(response, 400, { error: '신고 유형이 올바르지 않습니다.' });
  const message = typeof body.message === 'string' ? cleanReportText(body.message) : '';
  if (message.length < 5 || message.length > 2_000) return json(response, 400, { error: '신고 내용은 5자 이상 2,000자 이하로 입력해 주세요.' });

  const pack = loadActiveProblemPack(root);
  if (body.packId !== pack.manifest.id) return json(response, 400, { error: '현재 문제 팩과 일치하지 않습니다.' });
  const problem = pack.problems.find((item) => item.id === body.problemId);
  if (!problem) return json(response, 404, { error: '신고할 문제를 찾을 수 없습니다.' });

  const settings = githubReportSettings();
  if (!settings) return json(response, 503, { error: '문제 신고 기능이 아직 설정되지 않았습니다.' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const issueResponse = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}/issues`, {
      method: 'POST', signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json', 'User-Agent': 'monthly-ai-practice-report', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({
        title: `[문제 신고][${safeIssueText(problem.id, 100)}] ${REPORT_CATEGORIES.get(body.category)}`,
        body: reportIssueBody(pack.manifest, problem, body.category, message),
      }),
    });
    const payload = await issueResponse.json().catch(() => ({}));
    if (!issueResponse.ok) {
      console.error(`GitHub 문제 신고 생성 실패: ${issueResponse.status}`);
      const status = issueResponse.status === 403 || issueResponse.status === 429 ? 429 : issueResponse.status === 401 || issueResponse.status === 404 ? 503 : 502;
      return json(response, status, { error: status === 429 ? '신고 접수가 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.' : '신고 저장소에 연결하지 못했습니다.' });
    }
    return json(response, 201, { message: '문제 신고가 접수되었습니다.', issueUrl: payload.html_url });
  } catch (error) {
    return json(response, error.name === 'AbortError' ? 504 : 502, { error: error.name === 'AbortError' ? '신고 접수 시간이 초과되었습니다.' : '신고를 접수하지 못했습니다.' });
  } finally { clearTimeout(timeout); }
}

async function reviewCode(request, response) {
  if (!allow(request.socket.remoteAddress || 'unknown')) return json(response, 429, { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  let body;
  try { body = await readJson(request, 50_000); }
  catch { return json(response, 400, { error: '요청 형식이 올바르지 않습니다.' }); }
  const problem = loadActiveProblemPack(root).problems.find((item) => item.type === 'coding' && item.id === body.problemId);
  if (!problem) return json(response, 404, { error: '검토할 문제를 찾을 수 없습니다.' });
  if (typeof body.code !== 'string' || !body.code.trim()) return json(response, 400, { error: '검토할 코드를 입력해 주세요.' });
  if (body.code.length > 20_000) return json(response, 413, { error: '코드는 20,000자 이하로 입력해 주세요.' });
  if (typeof body.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 512) return json(response, 400, { error: '올바른 OpenAI API 키를 입력해 주세요.' });
  if (typeof body.model !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(body.model)) return json(response, 400, { error: '올바른 OpenAI 모델 ID를 입력해 주세요.' });

  const schema = {
    name: 'code_review', strict: true,
    schema: { type: 'object', additionalProperties: false, required: ['verdict', 'requirements', 'errors', 'missingEdgeCases', 'suggestion'], properties: {
      verdict: { type: 'string', enum: ['통과 가능', '수정 필요', '판정 불가'] },
      requirements: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['requirement', 'status', 'reason'], properties: { requirement: { type: 'string' }, status: { type: 'string', enum: ['충족', '미충족', '불확실'] }, reason: { type: 'string' } } } },
      errors: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['location', 'code', 'reason', 'fix'], properties: { location: { type: 'string' }, code: { type: 'string' }, reason: { type: 'string' }, fix: { type: 'string' } } } },
      missingEdgeCases: { type: 'array', items: { type: 'string' } }, suggestion: { type: 'string' },
    } },
  };
  const prompt = `당신은 한국어 코드 검토자입니다. 제공된 요구사항만 기준으로 기능 충족 여부를 평가하세요. 코드를 실행했다고 주장하지 마세요. 문법·정적 분석으로 확인한 사실과 추정을 구분하고, 불확실하면 오류로 단정하지 말고 '불확실' 또는 '판정 불가'로 표시하세요. 문제와 무관한 변경이나 단순 스타일 변경을 요구하지 마세요. 전체 재작성보다 오류와 최소 수정 방향을 우선하세요.\n\n문제: ${problem.title}\n설명: ${problem.content}\n요구사항:\n${problem.requirements.map((item) => `- ${item}`).join('\n')}\n제약 조건:\n${problem.constraints?.map((item) => `- ${item}`).join('\n') || '없음'}\n예시:\n${problem.example || '없음'}\n\n사용자 코드:\n${body.code}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const apiResponse = await fetch('https://api.openai.com/v1/responses', { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${body.apiKey.trim()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: body.model, input: prompt, max_output_tokens: 2000, store: false, text: { format: { type: 'json_schema', ...schema } } }) });
    const payload = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      const status = apiResponse.status === 429 ? 429 : apiResponse.status >= 500 ? 502 : 400;
      return json(response, status, { error: apiResponse.status === 429 ? 'AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' : 'AI 검토 요청에 실패했습니다.' });
    }
    const text = payload.output_text ?? payload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
    const result = JSON.parse(text);
    if (!validReview(result)) return json(response, 502, { error: 'AI가 올바른 검토 형식으로 응답하지 않았습니다.' });
    return json(response, 200, result);
  } catch (error) {
    return json(response, error.name === 'AbortError' ? 504 : 502, { error: error.name === 'AbortError' ? 'AI 검토 시간이 초과되었습니다.' : 'AI 응답을 처리하지 못했습니다.' });
  } finally { clearTimeout(timeout); }
}

function validReview(value) { return value && ['통과 가능', '수정 필요', '판정 불가'].includes(value.verdict) && Array.isArray(value.requirements) && Array.isArray(value.errors) && Array.isArray(value.missingEdgeCases) && typeof value.suggestion === 'string'; }
function publicManifest(manifest) { return { schemaVersion: manifest.schemaVersion, id: manifest.id, title: manifest.title, description: manifest.description || '' }; }
function allow(key) { return allowRequest(rateLimits, key, 5, 60_000); }
function allowRequest(store, key, limit, windowMs) { const now = Date.now(); const recent = (store.get(key) || []).filter((time) => now - time < windowMs); if (recent.length >= limit) return false; recent.push(now); store.set(key, recent); return true; }
function sameOrigin(request) { const origin = request.headers.origin; if (!origin) return true; try { return new URL(origin).host === request.headers.host; } catch { return false; } }
function cleanReportText(value) { return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim(); }
function safeIssueText(value, limit) { return String(value).replace(/[\r\n]/g, ' ').replace(/([\\`*_{}\[\]()<>#+.!|~-])/g, '\\$1').replace(/@/g, '@\u200b').slice(0, limit); }
function githubReportSettings() { const token = process.env.GITHUB_REPORT_TOKEN?.trim(); const owner = process.env.GITHUB_REPORT_OWNER?.trim(); const repo = process.env.GITHUB_REPORT_REPO?.trim(); if (!token || !owner || !repo || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null; return { token, owner, repo }; }
function reportIssueBody(manifest, problem, category, message) { return `## 문제 정보\n\n- 문제 팩: ${safeIssueText(manifest.title, 200)} (${safeIssueText(manifest.id, 100)})\n- 문제 ID: \`${safeIssueText(problem.id, 150)}\`\n- 단원: ${safeIssueText(problem.unit, 200)}\n- 유형: \`${safeIssueText(problem.type, 30)}\`\n- 제목: ${safeIssueText(problem.title, 300)}\n\n## 신고 유형\n\n${REPORT_CATEGORIES.get(category)}\n\n## 신고 내용\n\n${safeIssueText(message, 2_000)}\n\n---\n이 이슈는 문제 풀이 사이트의 익명 신고 기능으로 생성되었습니다.`; }
function readJson(request, limit) { return new Promise((resolve, reject) => { let raw = ''; request.on('data', (chunk) => { raw += chunk; if (raw.length > limit) request.destroy(); }); request.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('잘못된 JSON')); } }); request.on('error', reject); }); }
function json(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); }
function serveStatic(urlPath, response, headOnly) { const decoded = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath); const target = path.resolve(publicDir, `.${decoded}`); if (!target.startsWith(publicDir) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return json(response, 404, { error: '페이지를 찾을 수 없습니다.' }); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }; response.writeHead(200, { 'Content-Type': `${types[path.extname(target)] || 'application/octet-stream'}; charset=utf-8` }); response.end(headOnly ? undefined : fs.readFileSync(target)); }
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const match = line.match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, ''); } }

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n${PORT}번 포트가 이미 사용 중입니다.`);
    console.error('이미 실행 중인 서버를 종료하거나 다른 포트를 지정해 주세요.');
    console.error(`PowerShell 예시: $env:PORT=3001; npm.cmd run dev\n`);
    process.exitCode = 1;
    return;
  }
  console.error('서버를 시작하지 못했습니다.', error);
  process.exitCode = 1;
});

server.listen(PORT, () => console.log(`월말평가 연습실: http://localhost:${PORT}`));
